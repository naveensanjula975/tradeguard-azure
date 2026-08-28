import { fetchDashboardSummary, fetchRecentAlerts, fetchHighRiskTraders, fetchAlertTrends } from '../lib/api';
import { DashboardSummary, Alert } from '../types';

// ─── Utility helpers ─────────────────────────────────────────────────────────

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

function scoreClass(score: number) {
  if (score >= 80) return 'score-critical';
  if (score >= 60) return 'score-high';
  if (score >= 40) return 'score-medium';
  return 'score-low';
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Widget: Alert Severity Donut ─────────────────────────────────────────────

const SEVERITY_CONFIG = [
  { key: 'CRITICAL', color: '#f43f5e', label: 'Critical' },
  { key: 'HIGH',     color: '#f59e0b', label: 'High' },
  { key: 'MEDIUM',   color: '#38bdf8', label: 'Medium' },
  { key: 'LOW',      color: '#10b981', label: 'Low' },
];

function SeverityDonut({ bySeverity }: { bySeverity: Record<string, number> }) {
  const total = SEVERITY_CONFIG.reduce((s, c) => s + (bySeverity[c.key] ?? 0), 0);
  const R = 60;
  const cx = 80;
  const cy = 80;
  const stroke = 20;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const segments = SEVERITY_CONFIG.map((c) => {
    const count = bySeverity[c.key] ?? 0;
    const pct = total > 0 ? count / total : 0;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const seg  = { ...c, count, dash, gap, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="donut-chart-wrap">
      <svg viewBox="0 0 160 160" className="donut-svg">
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={stroke}
        />
        {total > 0 ? segments.map((seg) => (
          <circle
            key={seg.key}
            className="donut-segment"
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset + circumference * 0.25}
            strokeLinecap="butt"
            style={{ filter: `drop-shadow(0 0 4px ${seg.color}60)` }}
          />
        )) : (
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" className="donut-center-label">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="donut-center-sub">
          Total Alerts
        </text>
      </svg>
      <div className="donut-legend">
        {SEVERITY_CONFIG.map((c) => (
          <div key={c.key} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: c.color }} />
            <span>{c.label}</span>
            <span className="donut-legend-count">{bySeverity[c.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Widget: Top Triggered Rules ─────────────────────────────────────────────

function RuleBarChart({ byRule }: { byRule: Record<string, number> }) {
  const entries = Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0]?.[1] ?? 1;

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-text">No rule data yet.</div>
      </div>
    );
  }

  return (
    <div className="rule-bar-list">
      {entries.map(([rule, count]) => (
        <div key={rule} className="rule-bar-item">
          <div className="rule-bar-meta">
            <span className="rule-bar-name" title={rule}>{rule.replace(/_/g, ' ')}</span>
            <span className="rule-bar-count">{count}</span>
          </div>
          <div className="rule-bar-track">
            <div className="rule-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Widget: Live Activity Feed ───────────────────────────────────────────────

function ActivityFeed({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">No recent activity.</div>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {alerts.map((alert, i) => (
        <div key={alert.alert_id} className="activity-item" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="activity-timeline">
            <span className={`activity-dot ${alert.severity.toLowerCase()}`} />
            {i < alerts.length - 1 && <span className="activity-line" />}
          </div>
          <div className="activity-body">
            <div className="activity-title">{alert.title}</div>
            <div className="activity-meta">
              <span className="activity-trader">{alert.trader_id}</span>
              <span>·</span>
              <span className={severityBadgeClass(alert.severity)}>{alert.severity}</span>
              <span>·</span>
              <span className="activity-time">
                {timeAgo((alert as unknown as Record<string, string>).created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Widget: Risk Score Heatmap ───────────────────────────────────────────────

const HEATMAP_LEGEND = [
  { label: '≥80 Critical', color: 'rgba(244,63,94,0.6)' },
  { label: '60-79 High',   color: 'rgba(245,158,11,0.6)' },
  { label: '40-59 Medium', color: 'rgba(56,189,248,0.5)' },
  { label: '<40 Low',      color: 'rgba(16,185,129,0.5)' },
];

function RiskHeatmap({ traders }: { traders: { trader_id: string; risk_score: number; open_alerts: number }[] }) {
  if (traders.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ fontSize: '1.5rem' }}>✅</div>
        <div className="empty-state-text">No high-risk traders</div>
      </div>
    );
  }

  return (
    <>
      <div className="heatmap-grid">
        {traders.map((t) => (
          <div
            key={t.trader_id}
            className={`heatmap-tile ${scoreClass(t.risk_score)}`}
            title={`${t.trader_id} — score: ${t.risk_score}, alerts: ${t.open_alerts}`}
          >
            <span className="heatmap-score">{t.risk_score}</span>
            <span className="heatmap-id">{t.trader_id.slice(-6)}</span>
            <span className="heatmap-alerts">{t.open_alerts}⚑</span>
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        {HEATMAP_LEGEND.map((l) => (
          <div key={l.label} className="heatmap-legend-item">
            <span className="heatmap-legend-swatch" style={{ background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let summary: DashboardSummary | null = null;
  let recentAlerts: Alert[] = [];
  let highRiskTraders: { trader_id: string; risk_score: number; open_alerts: number }[] = [];
  let trends: { by_severity: Record<string, number>; by_rule: Record<string, number> } = { by_severity: {}, by_rule: {} };
  let error: string | null = null;

  try {
    [summary, recentAlerts, highRiskTraders, trends] = await Promise.all([
      fetchDashboardSummary(),
      fetchRecentAlerts(10),
      fetchHighRiskTraders(),
      fetchAlertTrends(),
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

      {/* ── Row 1: Metric Cards ── */}
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

      {/* ── Row 2: Recent Alerts Table + Severity Donut ── */}
      <div className="widget-row widget-row-2">

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

        {/* Severity Donut */}
        <div className="card fade-in">
          <div className="section-header">
            <h2 className="section-title">🎯 Alert Severity</h2>
          </div>
          <SeverityDonut bySeverity={trends.by_severity} />
        </div>

      </div>

      {/* ── Row 3: Rule Bar Chart + Activity Feed + Risk Heatmap ── */}
      <div className="widget-row widget-row-3">

        {/* Top Triggered Rules */}
        <div className="card fade-in">
          <div className="section-header">
            <h2 className="section-title">📋 Top Triggered Rules</h2>
          </div>
          <RuleBarChart byRule={trends.by_rule} />
        </div>

        {/* Live Activity Feed */}
        <div className="card fade-in">
          <div className="section-header">
            <h2 className="section-title">⚡ Live Activity</h2>
          </div>
          <ActivityFeed alerts={recentAlerts} />
        </div>

        {/* Risk Score Heatmap */}
        <div className="card fade-in">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title">🔥 Risk Heatmap</h2>
          </div>
          <RiskHeatmap traders={highRiskTraders} />
        </div>

      </div>
    </div>
  );
}
