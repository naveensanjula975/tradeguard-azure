'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAuditLogs } from '../../lib/api';
import { AuditLog } from '../../types';

function actionBadgeClass(action: string): string {
  if (action.includes('STATUS')) return 'badge action-status';
  if (action.includes('NOTE')) return 'badge action-note';
  if (action.includes('ASSIGN')) return 'badge action-assign';
  if (action.includes('RULE') || action.includes('THRESHOLD')) return 'badge action-rule';
  return 'badge action-default';
}

function initials(userId: string): string {
  return userId.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '??';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAuditLogs({ user_id: userIdFilter || undefined, entity_type: entityTypeFilter || undefined, limit, offset });
      setLogs(data.items); setTotal(data.total);
    } catch (e: any) { setError(e.message || 'Failed to load audit logs'); }
    finally { setLoading(false); }
  }, [userIdFilter, entityTypeFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Log ID', 'User ID', 'Entity Type', 'Entity ID', 'Action', 'Old Value', 'New Value', 'Timestamp'];
    const rows = logs.map(l => [l.id, l.user_id, l.entity_type, l.entity_id, l.action, `"${(l.old_value || '').replace(/"/g, '""')}"`, `"${(l.new_value || '').replace(/"/g, '""')}"`, `"${new Date(l.created_at).toLocaleString()}"`]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `tradeguard_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const uniqueUsers = new Set(logs.map(l => l.user_id)).size;
  const uniqueEntities = new Set(logs.map(l => l.entity_type)).size;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Compliance Audit Trail</h1>
            <p className="page-subtitle">Immutable log of analyst actions, rule modifications, and status changes</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV} disabled={logs.length === 0}>📥 Export CSV</button>
        </div>
      </div>

      {/* Activity Summary Strip */}
      <div className="stat-bar">
        {[
          { icon: '📜', label: 'Total Logs', value: total, color: 'var(--text-primary)' },
          { icon: '👤', label: 'Unique Users', value: uniqueUsers, color: 'var(--accent)' },
          { icon: '🗂️', label: 'Entity Types', value: uniqueEntities, color: 'var(--purple)' },
          { icon: '🔄', label: 'Status Changes', value: logs.filter(l => l.action.includes('STATUS')).length, color: '#c084fc' },
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

      {/* Toolbar */}
      <div className="toolbar">
        <select className="filter-select" value={entityTypeFilter} onChange={e => { setEntityTypeFilter(e.target.value); setOffset(0); }}>
          <option value="">All Entity Types</option>
          <option value="ALERT">ALERT</option>
          <option value="ALERT_NOTE">ALERT_NOTE</option>
          <option value="RISK_RULE">RISK_RULE</option>
        </select>
        <input type="text" className="filter-input" placeholder="Filter by User ID (e.g. ANALYST-001)" value={userIdFilter} onChange={e => { setUserIdFilter(e.target.value); setOffset(0); }} style={{ minWidth: 240 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setEntityTypeFilter(''); setUserIdFilter(''); setOffset(0); }}>Clear</button>

        {/* View toggle */}
        <div className="view-tabs" style={{ marginLeft: 'auto' }}>
          <button className={`view-tab ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>📋 Table</button>
          <button className={`view-tab ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setViewMode('timeline')}>⏱ Timeline</button>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{total} log{total !== 1 ? 's' : ''}</div>
      </div>

      {/* Content */}
      <div className="card" style={{ overflow: 'hidden', padding: viewMode === 'timeline' ? '0.5rem' : 0 }}>
        {error ? (
          <div style={{ padding: '2rem', color: 'var(--danger)', fontSize: '0.875rem' }}>⚠️ {error}</div>
        ) : loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading audit logs...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-text">No audit log entries found matching your filters.</div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User ID</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Action</th>
                  <th>Previous Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="td-secondary">{new Date(log.created_at).toLocaleString()}</td>
                    <td><span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{log.user_id}</span></td>
                    <td><span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.3)' }}>{log.entity_type}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.entity_id}</td>
                    <td><span className={actionBadgeClass(log.action)}>{log.action}</span></td>
                    <td className="td-secondary" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.old_value || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem', color: 'var(--success)' }}>{log.new_value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Timeline View */
          <div className="audit-timeline" style={{ padding: '0.5rem 1rem' }}>
            {logs.map((log, i) => (
              <div key={log.id} className="audit-tl-item">
                <div className="audit-tl-spine">
                  <div className="audit-avatar">{initials(log.user_id)}</div>
                  {i < logs.length - 1 && <div className="audit-tl-line" />}
                </div>
                <div className="audit-tl-body">
                  <div className="audit-tl-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="audit-tl-user">{log.user_id}</span>
                      <span className={actionBadgeClass(log.action)}>{log.action}</span>
                      <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.2)', fontSize: '0.65rem' }}>{log.entity_type}</span>
                    </div>
                    <span className="audit-tl-time">{timeAgo(log.created_at)}</span>
                  </div>
                  <div className="audit-tl-detail">
                    <span>on</span>
                    <span className="audit-tl-entity">{log.entity_id}</span>
                  </div>
                  {(log.old_value || log.new_value) && (
                    <div className="audit-tl-change">
                      {log.old_value && <span className="audit-old">{log.old_value}</span>}
                      {log.old_value && log.new_value && <span className="audit-arrow">→</span>}
                      {log.new_value && <span className="audit-new">{log.new_value}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
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

