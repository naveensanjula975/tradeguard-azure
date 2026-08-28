'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAlerts, updateAlertStatus, assignAlert, fetchNotes, createNote } from '../../lib/api';
import { Alert, AlertSeverity, AlertStatus } from '../../types';

const SEVERITY_OPTIONS: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTIONS: AlertStatus[] = ['NEW', 'UNDER_REVIEW', 'ESCALATED', 'CONFIRMED', 'FALSE_POSITIVE', 'CLOSED'];
const SEVERITY_ICONS: Record<string, string> = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🔵', LOW: '🟢' };

function severityBadgeClass(s: string) {
  const m: Record<string, string> = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
  return `badge ${m[s] || ''}`;
}
function statusBadgeClass(s: string) {
  const m: Record<string, string> = { NEW: 'badge-new', UNDER_REVIEW: 'badge-review', ESCALATED: 'badge-escalated', CONFIRMED: 'badge-confirmed', FALSE_POSITIVE: 'badge-fp', CLOSED: 'badge-closed' };
  return `badge ${m[s] || ''}`;
}
function rowClass(severity: string) {
  const m: Record<string, string> = { CRITICAL: 'row-critical', HIGH: 'row-high', MEDIUM: 'row-medium', LOW: 'row-low' };
  return m[severity] || '';
}
function RiskBar({ score, severity }: { score: number; severity: string }) {
  return (
    <div className="risk-bar-wrap">
      <div className="risk-bar" style={{ minWidth: 70 }}>
        <div className={`risk-bar-fill ${severity.toLowerCase()}`} style={{ width: `${score}%` }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 28 }}>{score.toFixed(0)}</span>
    </div>
  );
}
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`toast ${type}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <span>{type === 'success' ? '✅' : '❌'} {message}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>×</button>
      </div>
    </div>
  );
}

interface NoteItem { id: number; alert_id: string; author_id: string; note: string; created_at: string; }

function AlertDetailPanel({ alert, onClose, onUpdated }: { alert: Alert; onClose: () => void; onUpdated: () => void }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [authorId, setAuthorId] = useState('ANALYST-001');
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus>(alert.status);
  const [analystId, setAnalystId] = useState(alert.assigned_to || '');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const sev = alert.severity.toLowerCase();
  const sevEmoji: Record<string, string> = { critical: '🚨', high: '⚠️', medium: '🔔', low: '📋' };
  const sevColor: Record<string, string> = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--accent)', low: 'var(--success)' };

  const loadNotes = useCallback(async () => {
    try { const data = await fetchNotes(alert.alert_id); setNotes(data.notes || []); } catch {}
  }, [alert.alert_id]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleStatusUpdate = async () => {
    setLoading(true);
    try { await updateAlertStatus(alert.alert_id, selectedStatus); setToast({ msg: `Status updated to ${selectedStatus}`, type: 'success' }); onUpdated(); }
    catch { setToast({ msg: 'Failed to update status', type: 'error' }); }
    finally { setLoading(false); }
  };
  const handleAssign = async () => {
    if (!analystId.trim()) return; setLoading(true);
    try { await assignAlert(alert.alert_id, analystId.trim()); setToast({ msg: `Assigned to ${analystId}`, type: 'success' }); onUpdated(); }
    catch { setToast({ msg: 'Failed to assign alert', type: 'error' }); }
    finally { setLoading(false); }
  };
  const handleAddNote = async () => {
    if (!noteText.trim()) return; setLoading(true);
    try { await createNote(alert.alert_id, authorId, noteText.trim()); setNoteText(''); await loadNotes(); setToast({ msg: 'Note added', type: 'success' }); }
    catch { setToast({ msg: 'Failed to add note', type: 'error' }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 200 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent)' }}>{alert.alert_id}</div>
            <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{alert.title}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕ Close</button>
        </div>
        <div className={`panel-severity-banner ${sev}`}>
          <div className={`panel-severity-icon ${sev}`}>{sevEmoji[sev] ?? '⚡'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={severityBadgeClass(alert.severity)}>{alert.severity}</span>
              <span className={statusBadgeClass(alert.status)}>{alert.status.replace('_', ' ')}</span>
              {alert.assigned_to && <span className="badge" style={{ background: 'var(--purple-dim)', color: 'var(--purple)', borderColor: 'rgba(168,85,247,0.3)' }}>👤 {alert.assigned_to}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Score</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: sevColor[sev] }}>{alert.final_risk_score.toFixed(1)}</div>
          </div>
        </div>
        <div style={{ padding: '1.5rem', flex: 1 }}>
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
            <div className="detail-row"><span className="detail-label">Trader ID</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{alert.trader_id}</span></div>
            <div className="detail-row"><span className="detail-label">Rule Code</span><span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{alert.rule_code}</span></div>
            <div className="detail-row"><span className="detail-label">Rule Score</span><span className="detail-value"><RiskBar score={alert.rule_score} severity={alert.severity} /></span></div>
            <div className="detail-row"><span className="detail-label">Anomaly Score</span><span className="detail-value"><RiskBar score={alert.anomaly_score} severity={alert.anomaly_score >= 60 ? 'HIGH' : 'LOW'} /></span></div>
            <div className="detail-row"><span className="detail-label">Detected At</span><span className="detail-value td-secondary">{new Date(alert.detected_at).toLocaleString()}</span></div>
            {alert.description && <div className="detail-row" style={{ flexDirection: 'column', gap: '0.5rem' }}><span className="detail-label">Description</span><span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{alert.description}</span></div>}
          </div>
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>Update Status</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select className="filter-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as AlertStatus)} style={{ flex: 1 }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleStatusUpdate} disabled={loading}>Update</button>
            </div>
          </div>
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>Assign to Analyst</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="ANALYST-001" value={analystId} onChange={e => setAnalystId(e.target.value)} style={{ flex: 1, padding: '0.45rem 0.75rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none' }} />
              <button className="btn btn-ghost btn-sm" onClick={handleAssign} disabled={loading || !analystId.trim()}>Assign</button>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Investigation Notes
              {notes.length > 0 && <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{notes.length}</span>}
            </div>
            {notes.length === 0 ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No notes yet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
                {notes.map(n => (
                  <div key={n.id} className="note-item">
                    <div className="note-header"><span className="note-author">{n.author_id}</span><span className="note-time">{new Date(n.created_at).toLocaleString()}</span></div>
                    <p className="note-body">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input type="text" placeholder="Your analyst ID" value={authorId} onChange={e => setAuthorId(e.target.value)} style={{ width: 140, padding: '0.4rem 0.625rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <textarea placeholder="Add an investigation note..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={loading || !noteText.trim()} style={{ marginTop: '0.5rem', width: '100%' }}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '+ Add Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [traderFilter, setTraderFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAlerts({ severity: severityFilter || undefined, status: statusFilter || undefined, trader_id: traderFilter || undefined, limit, offset });
      setAlerts(data.items); setTotal(data.total);
    } catch (e: any) { setError(e.message || 'Failed to load alerts'); }
    finally { setLoading(false); }
  }, [severityFilter, statusFilter, traderFilter, offset]);

  useEffect(() => { load(); }, [load]);
  const handleFilterChange = () => { setOffset(0); };

  const handleExportCSV = () => {
    if (alerts.length === 0) return;
    const headers = ['Alert ID', 'Trader ID', 'Rule Code', 'Title', 'Risk Score', 'Severity', 'Status', 'Detected At'];
    const rows = alerts.map(a => [a.alert_id, a.trader_id, a.rule_code, `"${a.title.replace(/"/g, '""')}"`, a.final_risk_score, a.severity, a.status, `"${new Date(a.detected_at).toLocaleString()}"`]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `tradeguard_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const critCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const openCount = alerts.filter(a => ['NEW', 'UNDER_REVIEW', 'ESCALATED'].includes(a.status)).length;

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {selectedAlert && <AlertDetailPanel alert={selectedAlert} onClose={() => setSelectedAlert(null)} onUpdated={() => { load(); setSelectedAlert(null); }} />}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div><h1 className="page-title">Alert Investigation</h1><p className="page-subtitle">Review, triage, and resolve compliance alerts</p></div>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV} disabled={alerts.length === 0}>📥 Export CSV</button>
        </div>
      </div>

      <div className="stat-bar">
        {[
          { icon: '📊', label: 'Total Shown', value: total, color: 'var(--text-primary)' },
          { icon: '🚨', label: 'Critical', value: critCount, color: 'var(--danger)' },
          { icon: '⚠️', label: 'High', value: highCount, color: 'var(--warning)' },
          { icon: '🔓', label: 'Open', value: openCount, color: 'var(--accent)' },
        ].map(p => (
          <div key={p.label} className="stat-pill">
            <span className="stat-pill-icon">{p.icon}</span>
            <div className="stat-pill-body">
              <span className="stat-pill-label">{p.label}</span>
              <span className="stat-pill-value" style={{ color: p.color }}>{p.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <div className="filter-chips">
          <button className={`filter-chip ${severityFilter === '' ? 'active-all' : ''}`} onClick={() => { setSeverityFilter(''); handleFilterChange(); }}>All</button>
          {SEVERITY_OPTIONS.map(s => (
            <button key={s} className={`filter-chip ${severityFilter === s ? `active-${s.toLowerCase()}` : ''}`} onClick={() => { setSeverityFilter(s === severityFilter ? '' : s); handleFilterChange(); }}>
              {SEVERITY_ICONS[s]} {s}
            </button>
          ))}
        </div>
        <select id="status-filter" className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange(); }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <input type="text" id="trader-filter" className="filter-input" placeholder="Trader ID (e.g. TRD-1001)" value={traderFilter} onChange={e => { setTraderFilter(e.target.value); handleFilterChange(); }} style={{ minWidth: 200 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setSeverityFilter(''); setStatusFilter(''); setTraderFilter(''); setOffset(0); }}>Clear</button>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {error ? (
          <div style={{ padding: '2rem', color: 'var(--danger)', fontSize: '0.875rem' }}>⚠️ {error}</div>
        ) : loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading alerts...</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">No alerts match your filters.<br />Try running the simulator to generate events.</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alert ID</th><th>Trader</th><th>Title</th><th>Risk Score</th><th>Severity</th><th>Status</th><th>Detected</th><th>Actions</th></tr></thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.alert_id} className={rowClass(alert.severity)}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{alert.alert_id}</span></td>
                    <td className="td-secondary">{alert.trader_id}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{alert.title}</td>
                    <td><RiskBar score={alert.final_risk_score} severity={alert.severity} /></td>
                    <td><span className={severityBadgeClass(alert.severity)}>{alert.severity}</span></td>
                    <td><span className={statusBadgeClass(alert.status)}>{alert.status.replace('_', ' ')}</span></td>
                    <td className="td-secondary">{new Date(alert.detected_at).toLocaleDateString()}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setSelectedAlert(alert)} id={`investigate-${alert.alert_id}`}>Investigate →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>← Prev</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}>Next →</button>
        </div>
      )}
    </div>
  );
}
