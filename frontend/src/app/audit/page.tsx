'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAuditLogs } from '../../lib/api';
import { AuditLog } from '../../types';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs({
        user_id: userIdFilter || undefined,
        entity_type: entityTypeFilter || undefined,
        limit,
        offset,
      });
      setLogs(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [userIdFilter, entityTypeFilter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Log ID', 'User ID', 'Entity Type', 'Entity ID', 'Action', 'Old Value', 'New Value', 'Timestamp'];
    const rows = logs.map(l => [
      l.id,
      l.user_id,
      l.entity_type,
      l.entity_id,
      l.action,
      `"${(l.old_value || '').replace(/"/g, '""')}"`,
      `"${(l.new_value || '').replace(/"/g, '""')}"`,
      `"${new Date(l.created_at).toLocaleString()}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tradeguard_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Compliance Audit Trail</h1>
        <p className="page-subtitle">Immutable log of analyst actions, rule modifications, and status changes</p>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <select
          className="filter-select"
          value={entityTypeFilter}
          onChange={e => { setEntityTypeFilter(e.target.value); setOffset(0); }}
        >
          <option value="">All Entity Types</option>
          <option value="ALERT">ALERT</option>
          <option value="ALERT_NOTE">ALERT_NOTE</option>
          <option value="RISK_RULE">RISK_RULE</option>
        </select>

        <input
          type="text"
          className="filter-input"
          placeholder="Filter by User ID (e.g. ANALYST-001)"
          value={userIdFilter}
          onChange={e => { setUserIdFilter(e.target.value); setOffset(0); }}
          style={{ minWidth: 240 }}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setEntityTypeFilter(''); setUserIdFilter(''); setOffset(0); }}
        >
          Clear
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={handleExportCSV}
          disabled={logs.length === 0}
          title="Export audit logs as CSV"
        >
          📥 Export CSV
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {total} audit log{total !== 1 ? 's' : ''} recorded
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {error ? (
          <div style={{ padding: '2rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
            ⚠️ {error}
          </div>
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
        ) : (
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
                    <td className="td-secondary">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {log.user_id}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.3)' }}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {log.entity_id}
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--purple-dim)', color: 'var(--purple)', borderColor: 'rgba(168,85,247,0.3)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="td-secondary" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.old_value || '—'}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem', color: 'var(--success)' }}>
                      {log.new_value || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
            ← Prev
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
