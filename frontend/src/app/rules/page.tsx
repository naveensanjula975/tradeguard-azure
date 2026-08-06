'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchRiskRules, updateRule } from '../../lib/api';
import { RiskRule } from '../../types';

function severityBadgeClass(s: string) {
  const m: Record<string, string> = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
  return `badge ${m[s] || ''}`;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast ${type}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <span>{type === 'success' ? '✅' : '❌'} {message}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>×</button>
      </div>
    </div>
  );
}

interface EditState {
  [code: string]: { threshold: string; enabled: boolean; dirty: boolean; saving: boolean };
}

export default function RulesPage() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskRules();
      setRules(data);
      const initial: EditState = {};
      data.forEach(r => {
        initial[r.code] = { threshold: String(r.threshold), enabled: r.enabled, dirty: false, saving: false };
      });
      setEditState(initial);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleThresholdChange = (code: string, value: string) => {
    setEditState(prev => ({
      ...prev,
      [code]: { ...prev[code], threshold: value, dirty: true },
    }));
  };

  const handleToggle = async (code: string) => {
    const current = editState[code];
    if (!current) return;
    const newEnabled = !current.enabled;
    setEditState(prev => ({ ...prev, [code]: { ...prev[code], enabled: newEnabled, saving: true } }));
    try {
      await updateRule(code, parseFloat(current.threshold) || 0, newEnabled);
      setEditState(prev => ({ ...prev, [code]: { ...prev[code], saving: false, dirty: false } }));
      setToast({ msg: `${code} ${newEnabled ? 'enabled' : 'disabled'}`, type: 'success' });
    } catch {
      setEditState(prev => ({ ...prev, [code]: { ...prev[code], enabled: !newEnabled, saving: false } }));
      setToast({ msg: 'Failed to update rule', type: 'error' });
    }
  };

  const handleSave = async (code: string) => {
    const state = editState[code];
    const threshold = parseFloat(state.threshold);
    if (isNaN(threshold) || threshold < 0) {
      setToast({ msg: 'Invalid threshold value', type: 'error' });
      return;
    }
    setEditState(prev => ({ ...prev, [code]: { ...prev[code], saving: true } }));
    try {
      const updated = await updateRule(code, threshold, state.enabled);
      setEditState(prev => ({ ...prev, [code]: { threshold: String(updated.threshold), enabled: updated.enabled, dirty: false, saving: false } }));
      setToast({ msg: `${code} threshold saved`, type: 'success' });
    } catch {
      setEditState(prev => ({ ...prev, [code]: { ...prev[code], saving: false } }));
      setToast({ msg: 'Failed to save rule', type: 'error' });
    }
  };

  const handleReset = (code: string) => {
    const original = rules.find(r => r.code === code);
    if (!original) return;
    setEditState(prev => ({
      ...prev,
      [code]: { threshold: String(original.threshold), enabled: original.enabled, dirty: false, saving: false },
    }));
  };

  const enabledCount = Object.values(editState).filter(e => e.enabled).length;

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Risk Rule Management</h1>
            <p className="page-subtitle">Configure detection thresholds and enable/disable surveillance rules</p>
          </div>
          {!loading && (
            <div style={{
              display: 'flex', gap: '0.5rem', alignItems: 'center',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{enabledCount}</strong> / {rules.length} rules active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem',
        fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        ℹ️ Changes to thresholds take effect immediately for new events evaluated by the risk engine.
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading rules...</div>
        </div>
      ) : error ? (
        <div style={{ color: 'var(--danger)', fontSize: '0.875rem', padding: '2rem' }}>⚠️ {error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rules.map(rule => {
            const state = editState[rule.code];
            if (!state) return null;
            return (
              <div key={rule.code} className="card fade-in" style={{
                opacity: state.enabled ? 1 : 0.55,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Left: name + meta */}
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{rule.name}</span>
                      <span className={severityBadgeClass(rule.severity)}>{rule.severity}</span>
                      {state.dirty && (
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                          unsaved
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>
                      {rule.code}
                    </div>
                    {(rule as any).description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(rule as any).description}</div>
                    )}
                  </div>

                  {/* Right: controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Threshold editor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Threshold
                      </label>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <input
                          id={`threshold-${rule.code}`}
                          type="number"
                          value={state.threshold}
                          onChange={e => handleThresholdChange(rule.code, e.target.value)}
                          style={{
                            width: 110, padding: '0.4rem 0.625rem',
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            border: `1px solid ${state.dirty ? 'var(--warning)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.875rem', outline: 'none',
                          }}
                          disabled={!state.enabled}
                        />
                        {state.dirty && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSave(rule.code)}
                              disabled={state.saving}
                              id={`save-${rule.code}`}
                            >
                              {state.saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Save'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleReset(rule.code)}
                              disabled={state.saving}
                            >
                              Reset
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {state.enabled ? 'Enabled' : 'Disabled'}
                      </label>
                      <label className="toggle" htmlFor={`toggle-${rule.code}`} title={state.enabled ? 'Click to disable' : 'Click to enable'}>
                        <input
                          id={`toggle-${rule.code}`}
                          type="checkbox"
                          checked={state.enabled}
                          onChange={() => handleToggle(rule.code)}
                          disabled={state.saving}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
