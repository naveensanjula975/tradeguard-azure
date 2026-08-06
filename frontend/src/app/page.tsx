import { fetchDashboardSummary, fetchRecentAlerts, fetchHighRiskTraders } from '../lib/api';
import { DashboardSummary, Alert } from '../types';

function severityBadgeClass(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: 'badge-critical',
    HIGH: 'badge-high',
    MEDIUM: 'badge-medium',
    LOW: 'badge-low',
  };
  return `badge ${map[severity] || ''}`;
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    NEW: 'badge-new',
    UNDER_REVIEW: 'badge-review',
    ESCALATED: 'badge-escalated',
    CONFIRMED: 'badge-confirmed',
    FALSE_POSITIVE: 'badge-fp',
    CLOSED: 'badge-closed',
  };
  return `badge ${map[status] || ''}`;
}

function RiskBar({ score, severity }: { score: number; severity: string }) {
  const cls = severity.toLowerCase();
  return (
    <div className="risk-bar-wrap">
      <div className="risk-bar" style={{ minWidth: 80 }}>
        <div className={`risk-bar-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 32 }}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

function MetricCard({
  title, value, colorClass, glowColor, delta, delay,
}: {
  title: string; value: string | number; colorClass?: string; glowColor?: string; delta?: string; delay?: number;
}) {
  return (
    <div className={`metric-card fade-in fade-in-delay-${delay ?? 0}`}>
      {glowColor && (
        <div className="metric-card-glow" style={{ background: glowColor }} />
      )}
      <div className="card-title">{title}</div>
      <div className={`card-value ${colorClass ?? ''}`}>{value.toLocaleString()}</div>
      {delta && <div className="card-delta">{delta}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  let summary: DashboardSummary | null = null;
  let recentAlerts: Alert[] = [];
  let highRiskTraders: { trader_id: string; risk_score: number; open_alerts: number }[] = [];
  let error: string | null = null;

  try {
    [summary, recentAlerts, highRiskTraders] = await Promise.all([
      fetchDashboardSummary(),
      fetchRecentAlerts(8),
      fetchHighRiskTraders(),
    ]);
  } catch {
    error = 'Could not connect to the alert-case-service. Make sure the backend is running.';
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Surveillance Overview</h1>
            <p className="page-subtitle">Real-time trade risk monitoring and compliance intelligence</p>
          </div>
          <div className="live-badge">
            <span className="live-dot" />
            Live
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'var(--danger-dim)',
          border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          color: '#fb7185',
          fontSize: '0.875rem',
          marginBottom: '2rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid">
        <MetricCard
          title="Events Processed"
          value={summary?.events_processed_today ?? 0}
          colorClass="accent"
          glowColor="var(--accent)"
          delta="All time"
          delay={1}
        />
        <MetricCard
          title="Open Alerts"
          value={summary?.total_open_alerts ?? 0}
          colorClass="warning"
          glowColor="var(--warning)"
          delta="NEW + UNDER REVIEW + ESCALATED"
          delay={2}
        />
        <MetricCard
          title="Critical Alerts"
          value={summary?.critical_alerts ?? 0}
          colorClass="danger"
          glowColor="var(--danger)"
          delta="Open and unresolved"
          delay={3}
        />
        <MetricCard
          title="High-Risk Traders"
          value={summary?.high_risk_traders ?? 0}
          colorClass="purple"
          glowColor="var(--purple)"
          delta="CRITICAL or HIGH open alerts"
          delay={4}
        />
        <MetricCard
          title="Confirmed Incidents"
          value={summary?.confirmed_incidents ?? 0}
          colorClass="success"
          glowColor="var(--success)"
          delay={1}
        />
        <MetricCard
          title="Avg Processing Time"
          value={`${summary?.average_processing_time_ms ?? '--'} ms`}
          delay={2}
        />
      </div>

      {/* Two-column: Recent Alerts + High-Risk Traders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Recent Alerts Table */}
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <div className="section-header">
            <h2 className="section-title">Recent Alerts</h2>
            <a href="/alerts" className="btn btn-ghost btn-sm">View All →</a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Trader</th>
                  <th>Rule</th>
                  <th>Risk Score</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-text">No alerts yet. Run the simulator to generate events.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentAlerts.map((alert) => (
                    <tr key={alert.alert_id}>
                      <td>
                        <a href={`/alerts?id=${alert.alert_id}`} style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {alert.alert_id}
                        </a>
                      </td>
                      <td className="td-secondary">{alert.trader_id}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {alert.title}
                      </td>
                      <td>
                        <RiskBar score={alert.final_risk_score} severity={alert.severity} />
                      </td>
                      <td><span className={severityBadgeClass(alert.severity)}>{alert.severity}</span></td>
                      <td><span className={statusBadgeClass(alert.status)}>{alert.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* High-Risk Traders Panel */}
        <div className="card fade-in" style={{ minWidth: 260, flexShrink: 0 }}>
          <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>🔥 High-Risk Traders</h2>
          {highRiskTraders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ fontSize: '1.5rem' }}>✅</div>
              <div className="empty-state-text">No high-risk traders</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {highRiskTraders.map((t, i) => (
                <div key={t.trader_id} style={{
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {t.trader_id}
                    </span>
                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{t.risk_score}</span>
                  </div>
                  <RiskBar score={t.risk_score} severity={t.risk_score >= 80 ? 'CRITICAL' : 'HIGH'} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    {t.open_alerts} open alert{t.open_alerts !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
