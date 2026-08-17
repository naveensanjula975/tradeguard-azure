'use client';

import { useState, useMemo, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────────────── */
type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type EntityType  = 'TRADER' | 'ACCOUNT' | 'IP_ADDRESS' | 'INSTITUTION' | 'DEVICE';
type WLStatus    = 'ACTIVE' | 'MONITORING' | 'RESOLVED';

interface WatchlistEntry {
  id: string;
  entityId: string;
  entityType: EntityType;
  name: string;
  threatLevel: ThreatLevel;
  status: WLStatus;
  reason: string;
  addedBy: string;
  addedAt: string;
  lastSeen: string;
  alertCount: number;
  jurisdiction: string;
  tags: string[];
  notes: string;
}

/* ─── Mock data ─────────────────────────────────────────── */
const INITIAL_ENTRIES: WatchlistEntry[] = [
  {
    id: 'wl-001', entityId: 'TRD-0042', entityType: 'TRADER',
    name: 'Viktor Orlenko',
    threatLevel: 'CRITICAL', status: 'ACTIVE',
    reason: 'Suspected coordinated spoofing across 3 exchanges. Pattern matches known manipulation ring.',
    addedBy: 'ANALYST-007', addedAt: '2026-08-10T09:12:00Z', lastSeen: '2 min ago',
    alertCount: 18, jurisdiction: 'Ukraine / Cyprus',
    tags: ['spoofing', 'coordinated', 'cross-venue'],
    notes: 'Linked to Redwood Capital offshore accounts. Escalated to legal.',
  },
  {
    id: 'wl-002', entityId: 'ACC-8812', entityType: 'ACCOUNT',
    name: 'Offshore Nominee – BVI-4421',
    threatLevel: 'HIGH', status: 'ACTIVE',
    reason: 'Nominee account used for layering proceeds of suspected wash-trading scheme.',
    addedBy: 'COMP-002', addedAt: '2026-08-05T14:30:00Z', lastSeen: '1 hr ago',
    alertCount: 9, jurisdiction: 'British Virgin Islands',
    tags: ['layering', 'wash-trade', 'nominee'],
    notes: 'FinCEN SAR filed on 2026-08-06.',
  },
  {
    id: 'wl-003', entityId: '185.220.101.47', entityType: 'IP_ADDRESS',
    name: '185.220.101.47',
    threatLevel: 'HIGH', status: 'MONITORING',
    reason: 'Tor exit node used to access platform from multiple unrelated accounts simultaneously.',
    addedBy: 'SECOPS-001', addedAt: '2026-08-12T07:55:00Z', lastSeen: '23 min ago',
    alertCount: 5, jurisdiction: 'Unknown (TOR)',
    tags: ['tor', 'anonymization', 'multi-account'],
    notes: 'Rate-limiting applied. Monitoring for continued access attempts.',
  },
  {
    id: 'wl-004', entityId: 'INST-CLD-229', entityType: 'INSTITUTION',
    name: 'Cleardale Capital Mgmt.',
    threatLevel: 'CRITICAL', status: 'ACTIVE',
    reason: 'Regulatory investigation by SEC for front-running institutional client orders.',
    addedBy: 'ANALYST-007', addedAt: '2026-07-28T11:00:00Z', lastSeen: '3 hrs ago',
    alertCount: 31, jurisdiction: 'United States',
    tags: ['front-running', 'institutional', 'sec-investigation'],
    notes: 'All trades by this institution flagged for manual review. Legal hold in place.',
  },
  {
    id: 'wl-005', entityId: 'TRD-0089', entityType: 'TRADER',
    name: 'Mei-Ling Huang',
    threatLevel: 'MEDIUM', status: 'MONITORING',
    reason: 'Unusual high-frequency order cancellation rate suggesting potential quote stuffing.',
    addedBy: 'COMP-002', addedAt: '2026-08-14T16:20:00Z', lastSeen: 'Yesterday',
    alertCount: 4, jurisdiction: 'Hong Kong',
    tags: ['quote-stuffing', 'hft', 'order-cancellation'],
    notes: 'Second occurrence this quarter. Formal warning issued.',
  },
  {
    id: 'wl-006', entityId: 'DEV-F9A2C1', entityType: 'DEVICE',
    name: 'Rooted Android – Device F9A2C1',
    threatLevel: 'MEDIUM', status: 'MONITORING',
    reason: 'Rooted/jailbroken device accessing trading platform. Potential script injection risk.',
    addedBy: 'SECOPS-001', addedAt: '2026-08-15T08:45:00Z', lastSeen: '2 days ago',
    alertCount: 2, jurisdiction: 'N/A',
    tags: ['device-security', 'rooted', 'script-risk'],
    notes: 'User notified. Session invalidated pending device compliance check.',
  },
  {
    id: 'wl-007', entityId: 'TRD-0017', entityType: 'TRADER',
    name: 'Rajiv Sethuraman',
    threatLevel: 'LOW', status: 'RESOLVED',
    reason: 'False-positive — anomaly caused by legitimate arbitrage strategy. Cleared after review.',
    addedBy: 'ANALYST-003', addedAt: '2026-08-01T10:00:00Z', lastSeen: '1 week ago',
    alertCount: 1, jurisdiction: 'Singapore',
    tags: ['false-positive', 'cleared'],
    notes: 'Resolved after 48-hr investigation. No further action required.',
  },
  {
    id: 'wl-008', entityId: 'ACC-3301', entityType: 'ACCOUNT',
    name: 'Straw Account – EUR-3301',
    threatLevel: 'HIGH', status: 'ACTIVE',
    reason: 'Account acting as conduit for proceeds of pump-and-dump scheme on small-cap equities.',
    addedBy: 'COMP-002', addedAt: '2026-08-08T13:15:00Z', lastSeen: '5 hrs ago',
    alertCount: 14, jurisdiction: 'Luxembourg',
    tags: ['pump-dump', 'conduit', 'small-cap'],
    notes: 'Assets frozen pending regulatory referral to ESMA.',
  },
];

/* ─── Helpers ────────────────────────────────────────────── */
const ENTITY_ICONS: Record<EntityType, string> = {
  TRADER: '👤', ACCOUNT: '🏦', IP_ADDRESS: '🌐', INSTITUTION: '🏛', DEVICE: '📱',
};

const THREAT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: 'var(--danger)', HIGH: 'var(--warning)', MEDIUM: '#60a5fa', LOW: 'var(--success)',
};

function ThreatBadge({ level }: { level: ThreatLevel }) {
  const icons: Record<ThreatLevel, string> = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🔵', LOW: '🟢' };
  return (
    <span className={`threat-badge threat-${level.toLowerCase()}`}>
      {icons[level]} {level}
    </span>
  );
}

function StatusCell({ status }: { status: WLStatus }) {
  if (status === 'ACTIVE')     return <span className="wl-active">⬤ Active</span>;
  if (status === 'MONITORING') return <span className="wl-monitoring">◉ Monitoring</span>;
  return <span className="wl-resolved">✓ Resolved</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Toast ─────────────────────────────────────────────── */
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
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

/* ─── Entity Detail Panel ────────────────────────────────── */
function EntityDetailPanel({ entry, onClose, onStatusChange, onRemove }: {
  entry: WatchlistEntry;
  onClose: () => void;
  onStatusChange: (id: string, status: WLStatus) => void;
  onRemove: (entry: WatchlistEntry) => void;
}) {
  return (
    <div className="entity-panel">
      <div className="entity-panel-header">
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {ENTITY_ICONS[entry.entityType]} {entry.name}
          </div>
          <div className="entity-id">{entry.entityId}</div>
        </div>
        <button className="entity-panel-close" onClick={onClose}>×</button>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <ThreatBadge level={entry.threatLevel} />
        <span className="entity-type">{ENTITY_ICONS[entry.entityType]} {entry.entityType.replace('_', ' ')}</span>
        <StatusCell status={entry.status} />
      </div>

      {/* Detail rows */}
      {[
        ['Jurisdiction', entry.jurisdiction],
        ['Added By',     entry.addedBy],
        ['Added On',     formatDate(entry.addedAt)],
        ['Last Seen',    entry.lastSeen],
        ['Alert Count',  String(entry.alertCount)],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: 180 }}>{value}</span>
        </div>
      ))}

      {/* Reason */}
      <div style={{ margin: '1rem 0 0.5rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Flagging Reason
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
        {entry.reason}
      </div>

      {/* Notes */}
      <div style={{ margin: '1rem 0 0.5rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Analyst Notes
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
        {entry.notes}
      </div>

      {/* Tags */}
      <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {entry.tags.map(tag => (
          <span key={tag} style={{ padding: '0.2rem 0.55rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: '9999px', fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 600 }}>
            #{tag}
          </span>
        ))}
      </div>

      {/* Status change */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
          Update Status
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['ACTIVE', 'MONITORING', 'RESOLVED'] as WLStatus[]).map(s => (
            <button
              key={s}
              className={`btn btn-sm ${entry.status === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onStatusChange(entry.id, s)}
              style={{ fontSize: '0.72rem' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Remove */}
      <div style={{ marginTop: '1rem' }}>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => onRemove(entry)}>
          🗑 Remove from Watchlist
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function WatchlistPage() {
  const [entries, setEntries]           = useState<WatchlistEntry[]>(INITIAL_ENTRIES);
  const [search, setSearch]             = useState('');
  const [threatFilter, setThreatFilter] = useState<ThreatLevel | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter]     = useState<EntityType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<WLStatus | 'ALL'>('ALL');
  const [selected, setSelected]         = useState<WatchlistEntry | null>(null);
  const [addOpen, setAddOpen]           = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WatchlistEntry | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Add-entity form state
  const [form, setForm] = useState({
    entityId: '', name: '', entityType: 'TRADER' as EntityType,
    threatLevel: 'HIGH' as ThreatLevel, reason: '', jurisdiction: '', notes: '',
  });
  const [formError, setFormError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  /* ── Derived stats ── */
  const stats = useMemo(() => ({
    total:    entries.length,
    active:   entries.filter(e => e.status === 'ACTIVE').length,
    critical: entries.filter(e => e.threatLevel === 'CRITICAL').length,
    resolved: entries.filter(e => e.status === 'RESOLVED').length,
    alerts:   entries.reduce((s, e) => s + e.alertCount, 0),
  }), [entries]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.entityId.toLowerCase().includes(q) ||
                          e.reason.toLowerCase().includes(q) || e.tags.some(t => t.includes(q));
      const matchThreat = threatFilter === 'ALL' || e.threatLevel === threatFilter;
      const matchType   = typeFilter   === 'ALL' || e.entityType  === typeFilter;
      const matchStatus = statusFilter === 'ALL' || e.status      === statusFilter;
      return matchSearch && matchThreat && matchType && matchStatus;
    });
  }, [entries, search, threatFilter, typeFilter, statusFilter]);

  /* ── Handlers ── */
  function handleStatusChange(id: string, status: WLStatus) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    setToast({ msg: `Status updated to ${status}`, type: 'success' });
  }

  function openRemove(entry: WatchlistEntry) {
    setRemoveTarget(entry);
    setSelected(null);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    setEntries(prev => prev.filter(e => e.id !== removeTarget.id));
    setRemoveTarget(null);
    setToast({ msg: `${removeTarget.name} removed from watchlist`, type: 'success' });
  }

  function submitAdd() {
    if (!form.entityId.trim() || !form.name.trim() || !form.reason.trim()) {
      setFormError('Entity ID, Name, and Reason are required.');
      return;
    }
    const newEntry: WatchlistEntry = {
      id:           `wl-${Date.now()}`,
      entityId:     form.entityId.trim().toUpperCase(),
      entityType:   form.entityType,
      name:         form.name.trim(),
      threatLevel:  form.threatLevel,
      status:       'ACTIVE',
      reason:       form.reason.trim(),
      addedBy:      'ANALYST-001',
      addedAt:      new Date().toISOString(),
      lastSeen:     'Never',
      alertCount:   0,
      jurisdiction: form.jurisdiction.trim() || 'Unknown',
      tags:         [],
      notes:        form.notes.trim() || '—',
    };
    setEntries(prev => [newEntry, ...prev]);
    setAddSuccess(true);
    setTimeout(() => {
      setAddOpen(false);
      setAddSuccess(false);
      setForm({ entityId: '', name: '', entityType: 'TRADER', threatLevel: 'HIGH', reason: '', jurisdiction: '', notes: '' });
      setFormError('');
    }, 1300);
  }

  const inputStyle = { width: '100%' };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Watchlist &amp; Blacklist</h1>
            <p className="page-subtitle">Track high-risk entities, flagged accounts, and compliance blacklists</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '9999px', padding: '0.35rem 0.875rem' }}>
              <span className="threat-pulse" /> Live Monitoring
            </div>
            <button id="add-entity-btn" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              ＋ Add Entity
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="wl-stats fade-in">
        {[
          { label: 'Total Entities', value: stats.total,    color: 'var(--accent)',   glow: 'rgba(56,189,248,0.3)'  },
          { label: 'Active Threats', value: stats.active,   color: 'var(--danger)',   glow: 'rgba(244,63,94,0.3)'  },
          { label: 'Critical Level', value: stats.critical, color: '#fb7185',         glow: 'rgba(244,63,94,0.3)'  },
          { label: 'Total Alerts',   value: stats.alerts,   color: 'var(--warning)',  glow: 'rgba(245,158,11,0.3)' },
          { label: 'Resolved',       value: stats.resolved, color: 'var(--success)',  glow: 'rgba(16,185,129,0.3)' },
        ].map(s => (
          <div key={s.label} className="wl-stat-card">
            <div className="wl-stat-glow" style={{ background: s.glow }} />
            <div className="wl-stat-label">{s.label}</div>
            <div className="wl-stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="card fade-in" style={{ overflow: 'hidden', marginRight: selected ? '372px' : 0, transition: 'margin-right 0.25s ease' }}>

        {/* Toolbar */}
        <div className="toolbar">
          <input
            id="wl-search"
            type="text"
            className="filter-input"
            placeholder="Search entity, ID, tag, or reason…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select id="wl-threat-filter" className="filter-select" value={threatFilter} onChange={e => setThreatFilter(e.target.value as ThreatLevel | 'ALL')}>
            <option value="ALL">All Threats</option>
            <option value="CRITICAL">🔴 Critical</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🔵 Medium</option>
            <option value="LOW">🟢 Low</option>
          </select>
          <select id="wl-type-filter" className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as EntityType | 'ALL')}>
            <option value="ALL">All Types</option>
            <option value="TRADER">👤 Trader</option>
            <option value="ACCOUNT">🏦 Account</option>
            <option value="IP_ADDRESS">🌐 IP Address</option>
            <option value="INSTITUTION">🏛 Institution</option>
            <option value="DEVICE">📱 Device</option>
          </select>
          <select id="wl-status-filter" className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WLStatus | 'ALL')}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MONITORING">Monitoring</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Type</th>
                <th>Threat</th>
                <th>Status</th>
                <th>Alerts</th>
                <th>Jurisdiction</th>
                <th>Added</th>
                <th>Last Seen</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div className="empty-state-text">No entities match your filters.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(entry => (
                  <tr
                    key={entry.id}
                    style={{
                      cursor: 'pointer',
                      background: selected?.id === entry.id ? 'rgba(56,189,248,0.05)' : undefined,
                      opacity: entry.status === 'RESOLVED' ? 0.65 : 1,
                    }}
                    onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
                  >
                    {/* Entity identity */}
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: entry.threatLevel === 'CRITICAL' ? '#fb7185' : 'var(--text-primary)' }}>
                          {entry.name}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--accent)' }}>
                          {entry.entityId}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="entity-type">{ENTITY_ICONS[entry.entityType]} {entry.entityType.replace('_', ' ')}</span>
                    </td>
                    <td><ThreatBadge level={entry.threatLevel} /></td>
                    <td><StatusCell status={entry.status} /></td>
                    <td>
                      <span style={{ fontWeight: 700, color: entry.alertCount > 10 ? 'var(--danger)' : entry.alertCount > 4 ? 'var(--warning)' : 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {entry.alertCount}
                      </span>
                    </td>
                    <td className="td-secondary">{entry.jurisdiction}</td>
                    <td className="td-secondary">{formatDate(entry.addedAt)}</td>
                    <td className="td-secondary">{entry.lastSeen}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="View details"
                          onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
                        >
                          🔎
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          title="Remove from watchlist"
                          onClick={() => openRemove(entry)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Showing <strong style={{ color: 'var(--text-secondary)' }}>{filtered.length}</strong> of {entries.length} entities</span>
          <span>Click a row to open the detail panel →</span>
        </div>
      </div>

      {/* ── Entity Detail Panel ── */}
      {selected && (
        <EntityDetailPanel
          entry={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onRemove={openRemove}
        />
      )}

      {/* ── Add Entity Modal ── */}
      {addOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className="modal-card">
            <button className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            <div className="modal-title">Add to Watchlist</div>
            <div className="modal-subtitle">Flag a new entity for compliance monitoring or blacklisting.</div>

            {addSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--success)', fontSize: '1.1rem', fontWeight: 600 }}>
                ✓ Entity added to watchlist!
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="form-entity-id">Entity ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input id="form-entity-id" type="text" placeholder="TRD-0099" style={inputStyle}
                      value={form.entityId} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="form-entity-type">Entity Type</label>
                    <select id="form-entity-type" style={inputStyle}
                      value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value as EntityType }))}>
                      <option value="TRADER">👤 Trader</option>
                      <option value="ACCOUNT">🏦 Account</option>
                      <option value="IP_ADDRESS">🌐 IP Address</option>
                      <option value="INSTITUTION">🏛 Institution</option>
                      <option value="DEVICE">📱 Device</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="form-name">Display Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input id="form-name" type="text" placeholder="John Smith" style={inputStyle}
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="form-threat">Threat Level</label>
                    <select id="form-threat" style={inputStyle}
                      value={form.threatLevel} onChange={e => setForm(f => ({ ...f, threatLevel: e.target.value as ThreatLevel }))}>
                      <option value="CRITICAL">🔴 Critical</option>
                      <option value="HIGH">🟠 High</option>
                      <option value="MEDIUM">🔵 Medium</option>
                      <option value="LOW">🟢 Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="form-reason">Flagging Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea id="form-reason" placeholder="Describe the reason for adding this entity to the watchlist…" rows={3}
                    style={{ width: '100%' }} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="form-jurisdiction">Jurisdiction</label>
                    <input id="form-jurisdiction" type="text" placeholder="e.g. United States" style={inputStyle}
                      value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="form-notes">Analyst Notes</label>
                    <input id="form-notes" type="text" placeholder="Optional notes…" style={inputStyle}
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                {formError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>⚠ {formError}</div>
                )}

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button id="confirm-add-entity-btn" className="btn btn-primary" onClick={submitAdd}>
                    Add to Watchlist
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Remove Confirmation Modal ── */}
      {removeTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRemoveTarget(null); }}>
          <div className="modal-card">
            <button className="modal-close" onClick={() => setRemoveTarget(null)}>×</button>
            <div className="modal-title">Remove from Watchlist</div>
            <div className="modal-subtitle">This will permanently remove the entry. Audit logs are preserved.</div>
            <div style={{ padding: '1rem', background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: '#fb7185', marginBottom: '1rem' }}>
              ⚠ Removing <strong>{removeTarget.name}</strong> ({removeTarget.entityId}) — a{' '}
              <strong>{removeTarget.threatLevel}</strong> threat — from active monitoring.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button id="confirm-remove-entity-btn" className="btn btn-danger" onClick={confirmRemove}>
                Remove Entity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
