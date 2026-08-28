'use client';

import { useState, useCallback } from 'react';
import { runSimulation } from '../../lib/api';
import { SimulationResult } from '../../types';

const SCENARIOS = [
  { value: 'wash_trading', label: '🔄 Wash Trading', description: 'Detects circular trades designed to inflate volume without genuine market activity.' },
  { value: 'spoofing', label: '👻 Spoofing', description: 'Identifies large orders placed and immediately cancelled to manipulate perceived liquidity.' },
  { value: 'front_running', label: '⚡ Front Running', description: 'Spots trades placed ahead of known client orders to profit from anticipated price moves.' },
  { value: 'layering', label: '🏗️ Layering', description: 'Detects stacked orders at multiple price levels used to create false order book depth.' },
  { value: 'momentum_ignition', label: '🚀 Momentum Ignition', description: 'Identifies aggressive trading designed to trigger stop-losses or momentum-following algorithms.' },
  { value: 'random', label: '🎲 Random Behaviour', description: 'Generates mixed trading activity to test general rule sensitivity and reduce false positives.' },
];

const SEVERITY_COLOURS: Record<string, string> = {
  CRITICAL: 'var(--danger)', HIGH: 'var(--warning)', MEDIUM: 'var(--accent)', LOW: 'var(--success)',
};

function severityBadgeClass(s: string) {
  const m: Record<string, string> = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
  return `badge ${m[s] || ''}`;
}

interface StepState {
  generate: 'idle' | 'running' | 'done' | 'error';
  rules: 'idle' | 'running' | 'done' | 'error';
  anomaly: 'idle' | 'running' | 'done' | 'error';
  alert: 'idle' | 'running' | 'done' | 'error';
}

const STEPS: { key: keyof StepState; label: string; icon: string }[] = [
  { key: 'generate', label: 'Generating Trade Events', icon: '📡' },
  { key: 'rules', label: 'Evaluating Rule Engine', icon: '⚙️' },
  { key: 'anomaly', label: 'Running Anomaly Detection', icon: '🔬' },
  { key: 'alert', label: 'Creating Compliance Alerts', icon: '🚨' },
];

export default function SimulatorPage() {
  const [traderId, setTraderId] = useState('TRD-0001');
  const [scenario, setScenario] = useState('wash_trading');
  const [tradeCount, setTradeCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState>({ generate: 'idle', rules: 'idle', anomaly: 'idle', alert: 'idle' });

  const simulateSteps = async (traderId: string, scenario: string, tradeCount: number): Promise<SimulationResult> => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    setSteps({ generate: 'running', rules: 'idle', anomaly: 'idle', alert: 'idle' });
    await delay(600);
    setSteps(p => ({ ...p, generate: 'done', rules: 'running' }));
    await delay(700);
    setSteps(p => ({ ...p, rules: 'done', anomaly: 'running' }));
    await delay(500);
    setSteps(p => ({ ...p, anomaly: 'done', alert: 'running' }));
    const res = await runSimulation(traderId, scenario, tradeCount);
    setSteps(p => ({ ...p, alert: 'done' }));
    return res;
  };

  const handleRun = useCallback(async () => {
    if (!traderId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    setSteps({ generate: 'idle', rules: 'idle', anomaly: 'idle', alert: 'idle' });
    try {
      const res = await simulateSteps(traderId.trim(), scenario, tradeCount);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Simulation failed');
      setSteps({ generate: 'error', rules: 'error', anomaly: 'error', alert: 'error' });
    } finally {
      setLoading(false);
    }
  }, [traderId, scenario, tradeCount]);

  const selectedScenario = SCENARIOS.find(s => s.value === scenario);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Trade Surveillance Simulator</h1>
        <p className="page-subtitle">Generate synthetic trading events to validate detection rules and test alert generation</p>
      </div>

      {/* Config Card */}
      <div className="sim-layout">
        {/* Left: form */}
        <div className="card" style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Simulation Parameters</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Trader ID */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="trader-id" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trader ID</label>
              <input
                id="trader-id"
                type="text"
                value={traderId}
                onChange={e => setTraderId(e.target.value)}
                placeholder="e.g. TRD-0001"
                style={{ padding: '0.625rem 0.875rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Trade Count */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="trade-count" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trade Count &nbsp;<span style={{ color: 'var(--accent)', fontWeight: 700 }}>{tradeCount}</span>
              </label>
              <input
                id="trade-count"
                type="range"
                min={5}
                max={50}
                step={5}
                value={tradeCount}
                onChange={e => setTradeCount(Number(e.target.value))}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>5 events</span><span>50 events</span>
              </div>
            </div>

            {/* Scenario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scenario</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SCENARIOS.map(s => (
                  <label key={s.value} className={`scenario-option ${scenario === s.value ? 'selected' : ''}`} htmlFor={`scenario-${s.value}`}>
                    <input id={`scenario-${s.value}`} type="radio" name="scenario" value={s.value} checked={scenario === s.value} onChange={() => setScenario(s.value)} style={{ display: 'none' }} />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{s.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{s.description}</div>
                    </div>
                    {scenario === s.value && <span style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <button
              id="run-simulation"
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !traderId.trim()}
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} />Running...</>
              ) : (
                '▶ Run Simulation'
              )}
            </button>
          </div>
        </div>

        {/* Right: pipeline + results */}
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Pipeline Progress */}
          <div className="card">
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🔧</span> Detection Pipeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {STEPS.map((step, i) => {
                const state = steps[step.key];
                return (
                  <div key={step.key} className="pipeline-step">
                    <div className={`pipeline-dot ${state}`} />
                    {i < STEPS.length - 1 && <div className="pipeline-connector" />}
                    <div className="pipeline-label">
                      <span>{step.icon}</span>
                      <span style={{ opacity: state === 'idle' ? 0.4 : 1 }}>{step.label}</span>
                      {state === 'running' && <span className="spinner" style={{ width: 10, height: 10, marginLeft: 'auto' }} />}
                      {state === 'done' && <span style={{ marginLeft: 'auto', color: 'var(--success)' }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', padding: '1rem' }}>
              <div style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500 }}>⚠️ Simulation Error</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.375rem' }}>{error}</div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="card fade-in">
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📊</span> Simulation Results
              </div>

              {/* Summary grid */}
              <div className="results-grid">
                {[
                  { label: 'Trader ID', value: result.trader_id, mono: true },
                  { label: 'Scenario', value: selectedScenario?.label || result.scenario },
                  { label: 'Trades Generated', value: result.trades_generated ?? result.events_generated ?? '—' },
                  { label: 'Alerts Created', value: result.alerts_created },
                ].map(r => (
                  <div key={r.label} className="result-cell">
                    <div className="result-label">{r.label}</div>
                    <div className={`result-value ${r.mono ? 'mono' : ''}`}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Alert details */}
              {result.alert_ids && result.alert_ids.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Generated Alert IDs</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {result.alert_ids.map(id => (
                      <span key={id} style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56,189,248,0.2)' }}>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Severity breakdown */}
              {result.severity_breakdown && Object.keys(result.severity_breakdown).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Severity Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(result.severity_breakdown).map(([sev, count]) => (
                      <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={severityBadgeClass(sev)} style={{ minWidth: 70 }}>{sev}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, (count / result.alerts_created) * 100)}%`, background: SEVERITY_COLOURS[sev] || 'var(--accent)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Navigate to <a href="/alerts" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Alert Investigation →</a> to review generated alerts.
              </div>
            </div>
          )}

          {/* Idle Placeholder */}
          {!result && !error && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚀</div>
              <div style={{ fontWeight: 500, marginBottom: '0.375rem' }}>Ready to Simulate</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure parameters and click "Run Simulation" to generate synthetic trading events and test the detection pipeline.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

