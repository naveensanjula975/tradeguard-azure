'use client';

import { useState } from 'react';
import { triggerSimulationScenario } from '../../lib/api';

interface ResultItem {
  event_id: string;
  ingestion_status: number | string;
  response: any;
}

export default function SimulatorPage() {
  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastResults, setLastResults] = useState<ResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleRunSimulation = async (scenarioOverride?: string) => {
    const scenarioToRun = scenarioOverride || selectedScenario;
    setLoading(true);
    setError(null);
    setToast(null);

    try {
      const data = await triggerSimulationScenario(scenarioToRun, count);
      setLastResults(data.results || []);
      setToast(`Successfully generated ${count} event(s) for scenario: ${scenarioToRun}`);
    } catch (e: any) {
      setError(e.message || 'Failed to connect to simulator service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Trade Event Simulator</h1>
        <p className="page-subtitle">Generate synthetic market events to test risk rule evaluation and ML anomaly scoring</p>
      </div>

      {toast && (
        <div style={{
          background: 'var(--success-dim)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem',
          color: '#6ee7b7', fontSize: '0.875rem', marginBottom: '1.5rem',
        }}>
          ✅ {toast}
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem',
          color: '#fb7185', fontSize: '0.875rem', marginBottom: '1.5rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Scenario Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* Normal scenario */}
        <div className="card fade-in" style={{ cursor: 'pointer' }} onClick={() => handleRunSimulation('normal')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🟢</span>
            <span className="badge badge-low">LOW RISK</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Normal Trade</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Standard order size ($100–$20,000) from recognized device during market hours.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} disabled={loading}>
            {loading && selectedScenario === 'normal' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Run Normal Scenario →'}
          </button>
        </div>

        {/* Large Order scenario */}
        <div className="card fade-in fade-in-delay-1" style={{ cursor: 'pointer' }} onClick={() => handleRunSimulation('large_order')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <span className="badge badge-high">HIGH SEVERITY</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Large Order ($150k)</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Order value exceeds default $100,000 threshold. Triggers LARGE_ORDER rule.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} disabled={loading}>
            {loading && selectedScenario === 'large_order' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Run Large Order →'}
          </button>
        </div>

        {/* New Device High Value scenario */}
        <div className="card fade-in fade-in-delay-2" style={{ cursor: 'pointer' }} onClick={() => handleRunSimulation('new_device_high_value')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📱</span>
            <span className="badge badge-critical">CRITICAL</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>New Device & High Value</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Unrecognized device placing $60,000 order. Triggers NEW_DEVICE_HIGH_VALUE rule.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} disabled={loading}>
            {loading && selectedScenario === 'new_device_high_value' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Run New Device Scenario →'}
          </button>
        </div>

      </div>

      {/* Custom Simulation Controls */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h2 className="section-title">Custom Batch Simulation</h2>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.375rem' }}>
              Scenario Type
            </label>
            <select
              className="filter-select"
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="normal">Normal Activity</option>
              <option value="large_order">Large Order (&gt; $100k)</option>
              <option value="new_device_high_value">New Device &amp; High Value</option>
            </select>
          </div>

          <div style={{ flex: '0 0 120px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.375rem' }}>
              Event Count
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              style={{ width: '100%', padding: '0.45rem 0.75rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.875rem', outline: 'none' }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={() => handleRunSimulation()}
            disabled={loading}
            style={{ padding: '0.55rem 1.25rem' }}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '🚀 Dispatch Events'}
          </button>
        </div>
      </div>

      {/* Results Log */}
      {lastResults && (
        <div className="card fade-in">
          <div className="section-header">
            <h2 className="section-title">Execution Results ({lastResults.length} events)</h2>
            <a href="/alerts" className="btn btn-ghost btn-sm">View Generated Alerts →</a>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Ingestion Status</th>
                  <th>Risk Engine Response</th>
                </tr>
              </thead>
              <tbody>
                {lastResults.map((res, idx) => (
                  <tr key={res.event_id || idx}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>
                      {res.event_id}
                    </td>
                    <td>
                      <span className={`badge ${res.ingestion_status === 201 ? 'badge-low' : 'badge-critical'}`}>
                        HTTP {res.ingestion_status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(res.response)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
