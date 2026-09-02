'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/* ─── Types ───────────────────────────────────────────────────────── */
type CaseStage = 'TRIAGE' | 'EVIDENCE_GATHERING' | 'SUPERVISORY_REVIEW' | 'SAR_FILED' | 'CLOSED';
type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const STAGES_ORDER: CaseStage[] = [
  'TRIAGE',
  'EVIDENCE_GATHERING',
  'SUPERVISORY_REVIEW',
  'SAR_FILED',
  'CLOSED',
];

const STAGE_LABELS: Record<CaseStage, string> = {
  TRIAGE: 'Triage & Ingestion',
  EVIDENCE_GATHERING: 'Evidence Gathering',
  SUPERVISORY_REVIEW: 'Supervisory & Legal Review',
  SAR_FILED: 'SAR Filed / FinCEN',
  CLOSED: 'Closed & Enforced',
};

interface LinkedAlertSummary {
  id: string;
  ruleCode: string;
  title: string;
  severity: string;
  riskScore: number;
}

interface EvidenceItem {
  id: string;
  title: string;
  type: 'ORDER_BOOK_DUMP' | 'CHAT_TRANSCRIPT' | 'IP_TELEMETRY' | 'SAR_NARRATIVE' | 'REGULATORY_SUBPOENA';
  sha256: string;
  timestamp: string;
  sizeKb: number;
  author: string;
  summary: string;
}

interface CaseActivity {
  id: string;
  timestamp: string;
  author: string;
  role: string;
  action: string;
  details: string;
}

interface Case {
  id: string;
  title: string;
  targetTraderId: string;
  targetTraderName: string;
  targetDesk: string;
  priority: CasePriority;
  stage: CaseStage;
  assignedLead: string;
  openedAt: string;
  updatedAt: string;
  estimatedExposure: number;
  regulatoryViolations: string[];
  hypothesis: string;
  findings: string;
  sarReference?: string;
  sarNarrative?: string;
  linkedAlerts: LinkedAlertSummary[];
  evidence: EvidenceItem[];
  activities: CaseActivity[];
}

/* ─── Initial Mock Cases ──────────────────────────────────────────── */
const INITIAL_CASES: Case[] = [
  {
    id: 'CASE-2026-081',
    title: 'Cross-Exchange Perpetuals Spoofing & Layering Ring',
    targetTraderId: 'TRD-0042',
    targetTraderName: 'Viktor Orlenko',
    targetDesk: 'Crypto Derivatives',
    priority: 'CRITICAL',
    stage: 'SUPERVISORY_REVIEW',
    assignedLead: 'ANALYST-007 (Sarah Chen)',
    openedAt: '2026-08-20',
    updatedAt: '2026-09-01 11:30',
    estimatedExposure: 4850000,
    regulatoryViolations: [
      'SEC Rule 10b-5 (Employment of Manipulative Devices)',
      'CFTC Section 6(c)(1) / Rule 180.1 (Prohibition on Spoofing)',
      'FinCEN 31 CFR § 1020.320 (Suspicious Activity Reporting)',
    ],
    hypothesis:
      'Subject is coordinating non-bona fide buy orders on Deribit to artificially elevate perpetual funding rates while executing offsetting short liquidations via nominee account ACC-8812 on Binance.',
    findings:
      'Forensic time-series analysis confirms 96% cancellation rate within 300ms of spoof order submission. Shared IP subnet with Tor exit node 185.220.101.47 confirms multi-venue identity link.',
    sarReference: 'SAR-2026-08-9921',
    sarNarrative:
      'Between August 10, 2026 and August 30, 2026, Viktor Orlenko (TRD-0042) engaged in repeated layering and spoofing in BTC-USDT-PERP and ETH-USDT contracts. Orders totaling over $48.5M in notional value were submitted without intent to execute, manipulating the order book imbalance. Concurrent execution by beneficiary nominee account ACC-8812 generated illicit profits estimated at $4,850,000.',
    linkedAlerts: [
      { id: 'ALT-9901', ruleCode: 'RULE-SPOOF-01', title: 'Cross-Venue Order Layering & Rapid Cancellation', severity: 'CRITICAL', riskScore: 96 },
      { id: 'ALT-9721', ruleCode: 'RULE-WASH-02', title: 'Circular Fill Execution with Sub-Account ACC-8812', severity: 'CRITICAL', riskScore: 92 },
      { id: 'ALT-9874', ruleCode: 'RULE-OFFHOURS-03', title: 'Unusual Midnight Trading Vol with Anonymized IP', severity: 'HIGH', riskScore: 84 },
    ],
    evidence: [
      {
        id: 'EVD-001',
        title: 'Deribit & Binance Cross-Book Millisecond Order Log',
        type: 'ORDER_BOOK_DUMP',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        timestamp: '2026-08-25 14:00',
        sizeKb: 4520,
        author: 'SURVEILLANCE_ENGINE',
        summary: 'Synchronized L2 order book captures demonstrating cancellation preceding price drop.',
      },
      {
        id: 'EVD-002',
        title: 'Tor Exit Node & Cyprus VPN Telemetry Logs',
        type: 'IP_TELEMETRY',
        sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        timestamp: '2026-08-28 09:15',
        sizeKb: 128,
        author: 'SECOPS-001',
        summary: 'Concurrent authentication session logs showing identical auth token hashes from dual IP routing.',
      },
    ],
    activities: [
      { id: 'ACT-1', timestamp: '2026-08-20 09:00', author: 'ANALYST-007', role: 'Surveillance Officer', action: 'Case Opened', details: 'Case initialized from critical alert cluster ALT-9901.' },
      { id: 'ACT-2', timestamp: '2026-08-25 16:30', author: 'ANALYST-007', role: 'Surveillance Officer', action: 'Evidence Packaged', details: 'Order book timestamps and nominee transaction history submitted to Evidence Locker.' },
      { id: 'ACT-3', timestamp: '2026-08-30 14:15', author: 'LEGAL-DESK', role: 'Chief Legal Counsel', action: 'Legal Hold Imposed', details: 'Trading limits curtailed to 50%; formal FinCEN SAR draft prepared.' },
    ],
  },
  {
    id: 'CASE-2026-074',
    title: 'London 4PM WMR Benchmark Fixing Pre-Hedging & Collusion',
    targetTraderId: 'TRD-0115',
    targetTraderName: 'Marcus Vance',
    targetDesk: 'FX & Rates',
    priority: 'CRITICAL',
    stage: 'EVIDENCE_GATHERING',
    assignedLead: 'LEGAL-US (David Sterling)',
    openedAt: '2026-08-26',
    updatedAt: '2026-09-01 10:15',
    estimatedExposure: 12500000,
    regulatoryViolations: [
      'MAR Article 12 (Market Manipulation in Benchmark Rate Setting)',
      'CFTC Section 9(a)(2) (Attempted Price Manipulation)',
      'FCA Principle 5 (Market Conduct Standard)',
    ],
    hypothesis:
      'Subject accumulated EUR/USD long inventory immediately prior to the 4:00 PM London Fix window, using aggressive bids to push the published benchmark higher before dumping inventory.',
    findings:
      'Bloomberg chat transcripts flag keywords including "push the fix" and "hold the line" 15 minutes before fix calculation.',
    sarReference: 'SAR-2026-08-9840 (Drafting)',
    sarNarrative:
      'Marcus Vance (TRD-0115) executed excessive block orders in EUR/USD during the 60-second calculation window of the WMR 4:00 PM benchmark, coordinating with external counterparty Cleardale Capital.',
    linkedAlerts: [
      { id: 'ALT-7712', ruleCode: 'RULE-WMR-FIX-01', title: 'Aggressive Bidding 45 Seconds Prior to 4PM WMR London Fix', severity: 'CRITICAL', riskScore: 91 },
      { id: 'ALT-7510', ruleCode: 'RULE-CHAT-FLAGS-03', title: 'Flagged Bloomberg Chat Collusion Terminology', severity: 'HIGH', riskScore: 80 },
    ],
    evidence: [
      {
        id: 'EVD-101',
        title: 'Bloomberg Chat Terminal Transcript #IB-44912',
        type: 'CHAT_TRANSCRIPT',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        timestamp: '2026-08-27 16:05',
        sizeKb: 64,
        author: 'COMPLIANCE-AI',
        summary: 'Extracted multilingual chat logs between Vance and Cleardale institutional dealer.',
      },
    ],
    activities: [
      { id: 'ACT-10', timestamp: '2026-08-26 17:00', author: 'LEGAL-US', role: 'Head of Investigations', action: 'Case Initialized', details: 'Subpoena alert generated via automated Bloomberg chat natural language processor.' },
      { id: 'ACT-11', timestamp: '2026-08-29 10:30', author: 'LEGAL-US', role: 'Head of Investigations', action: 'Evidence Extracted', details: 'Full 30-day voice and chat archive locked under litigation preservation.' },
    ],
  },
  {
    id: 'CASE-2026-069',
    title: 'HFT Opening Auction Quote Stuffing & Capacity Depletion',
    targetTraderId: 'TRD-0089',
    targetTraderName: 'Mei-Ling Huang',
    targetDesk: 'Equities',
    priority: 'HIGH',
    stage: 'TRIAGE',
    assignedLead: 'COMP-002 (Kenji Sato)',
    openedAt: '2026-08-29',
    updatedAt: '2026-09-02 08:45',
    estimatedExposure: 1800000,
    regulatoryViolations: [
      'HKEX Market Conduct Rule 5.12 (Order Entry Disruptions)',
      'SEC Rule 15c3-5 (Market Access Rule)',
    ],
    hypothesis:
      'HFT market making algorithm experienced recursive loop, flooding HKEX matching engine with >1,200 cancels/sec in 0700.HK opening auction.',
    findings:
      'Algorithm parameters did not contain hard throttles during opening uncrossing. Under supervisor interview.',
    linkedAlerts: [
      { id: 'ALT-8810', ruleCode: 'RULE-HFT-CANCEL-04', title: 'Excessive Cancel-to-Fill Ratio (>94%) during Market Open', severity: 'HIGH', riskScore: 76 },
      { id: 'ALT-8790', ruleCode: 'RULE-MKT-IMPACT-01', title: 'Quote Stuffing Surge on 0700.HK', severity: 'HIGH', riskScore: 72 },
    ],
    evidence: [],
    activities: [
      { id: 'ACT-20', timestamp: '2026-08-29 11:00', author: 'COMP-002', role: 'APAC Compliance Lead', action: 'Triage Opened', details: 'Algorithm halted pending risk throttle review.' },
    ],
  },
  {
    id: 'CASE-2026-052',
    title: 'Offshore Wash-Trading Syndicate via Nominee Entity',
    targetTraderId: 'ACC-8812',
    targetTraderName: 'Offshore Nominee – BVI-4421',
    targetDesk: 'Commodities',
    priority: 'HIGH',
    stage: 'SAR_FILED',
    assignedLead: 'ANALYST-007 (Sarah Chen)',
    openedAt: '2026-08-05',
    updatedAt: '2026-08-28 15:00',
    estimatedExposure: 3200000,
    regulatoryViolations: [
      'FinCEN SAR 31 CFR § 1020.320',
      'Bank Secrecy Act (BSA / AML Anti-Layering)',
    ],
    hypothesis:
      'Nominee corporation established in British Virgin Islands used to execute non-economic wash trades with proprietary desks to repatriate capital.',
    findings:
      'SAR officially submitted and confirmed by FinCEN. Bank accounts frozen under regulatory order.',
    sarReference: 'SAR-2026-08-7719-CONFIRMED',
    sarNarrative:
      'Formal SAR filed with FinCEN detailing money laundering wash trading sequence across Brent futures.',
    linkedAlerts: [],
    evidence: [
      {
        id: 'EVD-301',
        title: 'FinCEN Electronic Submission Confirmation Receipt',
        type: 'SAR_NARRATIVE',
        sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        timestamp: '2026-08-06 14:30',
        sizeKb: 18,
        author: 'FINCEN_GATEWAY',
        summary: 'Official confirmation ID #BSA-2026-99124.',
      },
    ],
    activities: [
      { id: 'ACT-30', timestamp: '2026-08-05 10:00', author: 'ANALYST-007', role: 'Compliance Officer', action: 'Investigation Initiated', details: 'AML red flag triggered.' },
      { id: 'ACT-31', timestamp: '2026-08-06 14:30', author: 'ANALYST-007', role: 'Compliance Officer', action: 'SAR Electronically Submitted', details: 'Filing confirmed with FinCEN.' },
      { id: 'ACT-32', timestamp: '2026-08-28 15:00', author: 'LEGAL-DESK', role: 'Legal Counsel', action: 'Case Closed / Enforced', details: 'Accounts frozen.' },
    ],
  },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function getPriorityBadgeClass(p: CasePriority): string {
  switch (p) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    case 'LOW': return 'badge badge-low';
  }
}

function getStageBadgeClass(s: CaseStage): string {
  switch (s) {
    case 'TRIAGE': return 'badge badge-new';
    case 'EVIDENCE_GATHERING': return 'badge badge-review';
    case 'SUPERVISORY_REVIEW': return 'badge badge-escalated';
    case 'SAR_FILED': return 'badge badge-confirmed';
    case 'CLOSED': return 'badge badge-closed';
  }
}

/* ─── Inner Content with SearchParams ─────────────────────────────── */
function CasesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get('id');

  const [cases, setCases] = useState<Case[]>(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialId);

  // Filters & Views
  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('KANBAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'FINDINGS' | 'EVIDENCE' | 'TIMELINE' | 'SAR'>('FINDINGS');

  // New Case Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTraderId, setNewTraderId] = useState('TRD-0042');
  const [newTraderName, setNewTraderName] = useState('Viktor Orlenko');
  const [newDesk, setNewDesk] = useState('Crypto Derivatives');
  const [newPriority, setNewPriority] = useState<CasePriority>('HIGH');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newExposure, setNewExposure] = useState('1000000');

  // New Note
  const [newNoteText, setNewNoteText] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (initialId) {
      setSelectedCaseId(initialId);
    }
  }, [initialId]);

  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return cases.find((c) => c.id === selectedCaseId) || null;
  }, [selectedCaseId, cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetTraderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetTraderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.hypothesis.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = stageFilter === 'ALL' || c.stage === stageFilter;
      const matchesPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;

      return matchesSearch && matchesStage && matchesPriority;
    });
  }, [cases, searchQuery, stageFilter, priorityFilter]);

  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    router.push(`/cases?id=${id}`);
  };

  const handleBackToOverview = () => {
    setSelectedCaseId(null);
    router.push('/cases');
  };

  const handleAdvanceStage = (caseId: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const currentIdx = STAGES_ORDER.indexOf(c.stage);
          if (currentIdx < STAGES_ORDER.length - 1) {
            const nextStage = STAGES_ORDER[currentIdx + 1];
            const newActivity: CaseActivity = {
              id: `ACT-${Date.now()}`,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
              author: 'COMPLIANCE-OFFICER',
              role: 'Lead Investigator',
              action: `Stage Advanced: ${STAGE_LABELS[nextStage]}`,
              details: `Case progressed from ${STAGE_LABELS[c.stage]} to ${STAGE_LABELS[nextStage]}.`,
            };

            setSuccessToast(`Case ${c.id} advanced to ${STAGE_LABELS[nextStage]}`);
            setTimeout(() => setSuccessToast(null), 3500);

            return {
              ...c,
              stage: nextStage,
              updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
              activities: [newActivity, ...c.activities],
            };
          }
        }
        return c;
      })
    );
  };

  const handleAddCaseNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedCase) return;

    const newActivity: CaseActivity = {
      id: `ACT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      author: 'ANALYST-007',
      role: 'Surveillance Investigator',
      action: 'Analyst Findings Registered',
      details: newNoteText.trim(),
    };

    setCases((prev) =>
      prev.map((c) => {
        if (c.id === selectedCase.id) {
          return {
            ...c,
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
            activities: [newActivity, ...c.activities],
          };
        }
        return c;
      })
    );

    setNewNoteText('');
    setSuccessToast('Investigation finding registered to case activity log.');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleCreateNewCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newId = `CASE-2026-0${Math.floor(Math.random() * 90 + 10)}`;
    const newCaseItem: Case = {
      id: newId,
      title: newTitle.trim(),
      targetTraderId: newTraderId,
      targetTraderName: newTraderName,
      targetDesk: newDesk,
      priority: newPriority,
      stage: 'TRIAGE',
      assignedLead: 'ANALYST-007 (Sarah Chen)',
      openedAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      estimatedExposure: parseFloat(newExposure) || 500000,
      regulatoryViolations: ['SEC Rule 10b-5 (Under Investigation)'],
      hypothesis: newHypothesis.trim() || 'Suspicious trade sequencing identified by automated ML surveillance engine.',
      findings: 'Initial case dossier opened. Evidence collection underway.',
      linkedAlerts: [],
      evidence: [],
      activities: [
        {
          id: `ACT-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          author: 'ANALYST-007',
          role: 'Compliance Officer',
          action: 'Case Dossier Initialized',
          details: 'Investigation created via compliance workspace wizard.',
        },
      ],
    };

    setCases([newCaseItem, ...cases]);
    setCreateModalOpen(false);
    setSelectedCaseId(newId);
    router.push(`/cases?id=${newId}`);
    setSuccessToast(`New Case ${newId} created successfully.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  /* ──────────────────────────────────────────────────────────────────
     RENDER: DEEP CASE DOSSIER VIEW
     ────────────────────────────────────────────────────────────────── */
  if (selectedCase) {
    const c = selectedCase;
    const stageIdx = STAGES_ORDER.indexOf(c.stage);

    return (
      <div className="fade-in">
        {/* Top Back Nav & Quick Jump */}
        <div className="trader-top-nav">
          <button className="trader-back-btn" onClick={handleBackToOverview}>
            <span>←</span> Back to Cases Pipeline
          </button>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Case File:</span>
            <select
              className="filter-select"
              value={c.id}
              onChange={(e) => handleSelectCase(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {cases.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.id}: {cs.title.slice(0, 32)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.875rem 1.25rem',
              color: '#34d399',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✓</span> {successToast}
          </div>
        )}

        {/* Case Stage Stepper */}
        <div className="stage-stepper-wrap">
          {STAGES_ORDER.map((st, idx) => {
            const isCompleted = idx < stageIdx;
            const isActive = idx === stageIdx;

            return (
              <React.Fragment key={st}>
                <div className={`stage-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  <div className="stage-step-icon">
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span className="stage-step-label">{STAGE_LABELS[st]}</span>
                </div>
                {idx < STAGES_ORDER.length - 1 && (
                  <div className={`stage-step-divider ${idx < stageIdx ? 'completed' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Case Hero Banner */}
        <div className="trader-hero">
          <div className="trader-hero-content">
            <div className="trader-identity">
              <div
                className="trader-avatar-large"
                style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.3), #0d1526)' }}
              >
                📁
              </div>
              <div>
                <div className="trader-hero-title">
                  <span>{c.title}</span>
                  <span className="trader-id-tag">{c.id}</span>
                  <span className={getPriorityBadgeClass(c.priority)}>{c.priority} PRIORITY</span>
                  <span className={getStageBadgeClass(c.stage)}>{STAGE_LABELS[c.stage]}</span>
                </div>
                <div className="trader-meta-row">
                  <div className="trader-meta-item">
                    <span>👤 Target Entity:</span>
                    <Link
                      href={`/traders?id=${c.targetTraderId}`}
                      style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {c.targetTraderName} ({c.targetTraderId})
                    </Link>
                  </div>
                  <div className="trader-meta-item">
                    <span>🏢 Desk:</span> <strong>{c.targetDesk}</strong>
                  </div>
                  <div className="trader-meta-item">
                    <span>👮 Lead Officer:</span> {c.assignedLead}
                  </div>
                  <div className="trader-meta-item">
                    <span>💰 Est. Illicit Exposure:</span>{' '}
                    <strong style={{ color: 'var(--danger)' }}>
                      ${(c.estimatedExposure / 1000000).toFixed(2)}M
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Progression Actions */}
            <div className="trader-hero-actions">
              {stageIdx < STAGES_ORDER.length - 1 && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleAdvanceStage(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <span>→</span> Advance to {STAGE_LABELS[STAGES_ORDER[stageIdx + 1]]}
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => {
                  alert(`Downloading complete cryptographic evidence packet for ${c.id}...`);
                }}
              >
                📥 Export Case Dossier
              </button>
            </div>
          </div>
        </div>

        {/* ── Dossier Tabs ── */}
        <div className="trader-tabs-bar">
          <button
            className={`trader-tab-btn ${activeTab === 'FINDINGS' ? 'active' : ''}`}
            onClick={() => setActiveTab('FINDINGS')}
          >
            <span>📋</span> Findings & Allegations
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'EVIDENCE' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVIDENCE')}
          >
            <span>📂</span> Evidence Locker & Linked Alerts
            <span className="tab-badge">{c.evidence.length + c.linkedAlerts.length}</span>
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'TIMELINE' ? 'active' : ''}`}
            onClick={() => setActiveTab('TIMELINE')}
          >
            <span>📜</span> Investigation Trail
            <span className="tab-badge">{c.activities.length}</span>
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'SAR' ? 'active' : ''}`}
            onClick={() => setActiveTab('SAR')}
          >
            <span>🏛️</span> FinCEN SAR Builder
          </button>
        </div>

        {/* ── TAB CONTENT ── */}

        {/* TAB 1: FINDINGS */}
        {activeTab === 'FINDINGS' && (
          <div className="fade-in">
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="section-header">
                <h3 className="section-title">🔍 Supervisory Hypothesis & Allegation</h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {c.hypothesis}
              </p>

              <div className="section-header">
                <h3 className="section-title">📊 Key Forensic Findings</h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {c.findings}
              </p>
            </div>

            <div className="card">
              <div className="section-header">
                <h3 className="section-title">⚖️ Cited Regulatory Statutes & Violations</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {c.regulatoryViolations.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(244,63,94,0.06)',
                      border: '1px solid rgba(244,63,94,0.2)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <span>⚠️</span> {v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EVIDENCE LOCKER */}
        {activeTab === 'EVIDENCE' && (
          <div className="fade-in">
            {/* Linked Alerts Section */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="section-header">
                <div>
                  <h3 className="section-title">Linked Surveillance Alerts ({c.linkedAlerts.length})</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Trigger events feeding into this formal investigation
                  </p>
                </div>
              </div>

              {c.linkedAlerts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-text">No direct alerts linked yet.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Alert ID</th>
                        <th>Rule Code</th>
                        <th>Incident Title</th>
                        <th>Risk Score</th>
                        <th>Severity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.linkedAlerts.map((alt) => (
                        <tr key={alt.id}>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{alt.id}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {alt.ruleCode}
                          </td>
                          <td style={{ fontWeight: 500 }}>{alt.title}</td>
                          <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{alt.riskScore}</td>
                          <td>
                            <span className={`badge badge-${alt.severity.toLowerCase()}`}>{alt.severity}</span>
                          </td>
                          <td>
                            <Link href={`/alerts?id=${alt.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem' }}>
                              Inspect Alert
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cryptographic Evidence Locker */}
            <div className="section-header">
              <div>
                <h3 className="section-title">Cryptographic Evidence Artifacts ({c.evidence.length})</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  All items cryptographically sealed with SHA-256 hashes for regulatory subpoena compliance
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  alert('Opening Evidence Upload Dialog for Case ' + c.id);
                }}
              >
                + Seal New Evidence
              </button>
            </div>

            <div className="evidence-grid">
              {c.evidence.map((evd) => (
                <div key={evd.id} className="evidence-card">
                  <div>
                    <div className="evidence-header">
                      <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                        {evd.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evd.sizeKb} KB</span>
                    </div>
                    <div className="evidence-title">{evd.title}</div>
                    <div className="evidence-meta">
                      Logged by {evd.author} · {evd.timestamp}
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                      {evd.summary}
                    </p>
                  </div>
                  <div>
                    <div className="evidence-hash">SHA-256: {evd.sha256}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TIMELINE & CASE NOTES */}
        {activeTab === 'TIMELINE' && (
          <div className="fade-in">
            {/* Add Note Form */}
            <div className="compliance-note-form">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                📝 Append Case Audit Finding / Supervisory Direction
              </h4>
              <form onSubmit={handleAddCaseNote}>
                <textarea
                  className="note-textarea"
                  placeholder="Record interview notes with desk head, subpoena response details, or legal hold status..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={3}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Record to Official Timeline
                  </button>
                </div>
              </form>
            </div>

            {/* Timeline Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {c.activities.map((act) => (
                <div key={act.id} className="note-item">
                  <div className="note-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="note-author">{act.author}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({act.role})</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: 4,
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                        }}
                      >
                        {act.action}
                      </span>
                    </div>
                    <span className="note-time">{act.timestamp}</span>
                  </div>
                  <div className="note-body">{act.details}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SAR BUILDER */}
        {activeTab === 'SAR' && (
          <div className="fade-in">
            <div className="sar-document">
              <div className="sar-seal-header">
                <div>
                  <div className="sar-seal-title">🏛️ FinCEN Form 111 — Suspicious Activity Report</div>
                  <div className="sar-seal-sub">US Department of the Treasury · Financial Crimes Enforcement Network</div>
                </div>
                <div>
                  <span className="badge badge-confirmed" style={{ fontSize: '0.75rem' }}>
                    {c.sarReference || 'Drafting Stage'}
                  </span>
                </div>
              </div>

              <div className="sar-field-grid">
                <div className="sar-field-group">
                  <span className="sar-field-label">Subject Legal Name</span>
                  <span className="sar-field-val">{c.targetTraderName}</span>
                </div>
                <div className="sar-field-group">
                  <span className="sar-field-label">Trader Identity ID</span>
                  <span className="sar-field-val" style={{ fontFamily: 'monospace' }}>{c.targetTraderId}</span>
                </div>
                <div className="sar-field-group">
                  <span className="sar-field-label">Desk / Department</span>
                  <span className="sar-field-val">{c.targetDesk}</span>
                </div>
                <div className="sar-field-group">
                  <span className="sar-field-label">Estimated Suspicious Amount</span>
                  <span className="sar-field-val" style={{ color: 'var(--danger)' }}>
                    ${c.estimatedExposure.toLocaleString()} USD
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div className="sar-field-label" style={{ marginBottom: '0.5rem' }}>
                  Suspicious Activity Narrative (Item 45)
                </div>
                <div className="sar-narrative-box">
                  {c.sarNarrative ||
                    `No formal narrative generated yet. Review findings in Tab 1 and click "Generate Automated SAR Narrative".`}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    alert('Validating FinCEN Form 111 XML payload structure... All validation checks PASSED.');
                  }}
                >
                  ✓ Validate Form XML
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    handleAdvanceStage(c.id);
                    setSuccessToast('SAR electronically transmitted to FinCEN Gateway. Confirmation ID logged.');
                  }}
                >
                  🚀 Electronically File SAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────
     RENDER: CASE PORTFOLIO (KANBAN & TABLE VIEWS)
     ────────────────────────────────────────────────────────────────── */
  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Cases & Investigations</h1>
            <p className="page-subtitle">End-to-end regulatory case management, evidence preservation, and FinCEN SAR filings</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
              + Open New Investigation Case
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid" style={{ marginBottom: '1.75rem' }}>
        <div className="metric-card">
          <div className="card-title">Active Investigations</div>
          <div className="card-value accent">
            {cases.filter((c) => c.stage !== 'CLOSED').length}
          </div>
          <div className="card-delta">Across {cases.length} Total Cases</div>
        </div>
        <div className="metric-card">
          <div className="card-title">Critical Priority</div>
          <div className="card-value danger">
            {cases.filter((c) => c.priority === 'CRITICAL' && c.stage !== 'CLOSED').length}
          </div>
          <div className="card-delta">High Regulatory Exposure</div>
        </div>
        <div className="metric-card">
          <div className="card-title">Supervisory Review</div>
          <div className="card-value warning">
            {cases.filter((c) => c.stage === 'SUPERVISORY_REVIEW').length}
          </div>
          <div className="card-delta">Pending Legal Sign-off</div>
        </div>
        <div className="metric-card">
          <div className="card-title">SARs Filed (YTD)</div>
          <div className="card-value purple">
            {cases.filter((c) => c.stage === 'SAR_FILED' || c.sarReference).length}
          </div>
          <div className="card-delta">FinCEN Submissions</div>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="trader-filter-bar">
        <div className="search-input-group">
          <span className="search-input-icon">🔍</span>
          <input
            type="text"
            placeholder="Search cases by ID, trader, desk, or allegation hypothesis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="filter-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All Stages</option>
            {STAGES_ORDER.map((st) => (
              <option key={st} value={st}>
                {STAGE_LABELS[st]}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Kanban vs Table Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'KANBAN' ? 'active' : ''}`}
              onClick={() => setViewMode('KANBAN')}
            >
              <span>📊</span> Kanban
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'TABLE' ? 'active' : ''}`}
              onClick={() => setViewMode('TABLE')}
            >
              <span>📑</span> Table
            </button>
          </div>
        </div>
      </div>

      {/* ── KANBAN PIPELINE VIEW ── */}
      {viewMode === 'KANBAN' && (
        <div className="kanban-board">
          {STAGES_ORDER.map((stage) => {
            const stageCases = filteredCases.filter((c) => c.stage === stage);

            return (
              <div key={stage} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span>{stage === 'SAR_FILED' ? '🏛️' : stage === 'CLOSED' ? '✅' : '📌'}</span>
                    {STAGE_LABELS[stage]}
                  </div>
                  <span className="kanban-count-badge">{stageCases.length}</span>
                </div>

                <div className="kanban-cards-list">
                  {stageCases.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      No cases in this stage
                    </div>
                  ) : (
                    stageCases.map((c) => (
                      <div
                        key={c.id}
                        className="kanban-card"
                        onClick={() => handleSelectCase(c.id)}
                      >
                        <div className="kanban-card-top">
                          <span className="kanban-card-id">{c.id}</span>
                          <span className={getPriorityBadgeClass(c.priority)}>{c.priority}</span>
                        </div>
                        <div className="kanban-card-title">{c.title}</div>
                        <div className="kanban-card-entity">
                          <span>👤</span> {c.targetTraderName} · <strong>{c.targetDesk}</strong>
                        </div>
                        <div className="kanban-card-footer">
                          <span>${(c.estimatedExposure / 1000000).toFixed(1)}M Exp.</span>
                          <span>{c.evidence.length} Evidence</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'TABLE' && (
        <div className="card fade-in">
          {filteredCases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">No cases matching current filters.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Case Title</th>
                    <th>Target Trader</th>
                    <th>Desk</th>
                    <th>Priority</th>
                    <th>Current Stage</th>
                    <th>Est. Exposure</th>
                    <th>Lead Officer</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{c.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</td>
                      <td>
                        <Link href={`/traders?id=${c.targetTraderId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                          {c.targetTraderName}
                        </Link>
                      </td>
                      <td className="td-secondary">{c.targetDesk}</td>
                      <td>
                        <span className={getPriorityBadgeClass(c.priority)}>{c.priority}</span>
                      </td>
                      <td>
                        <span className={getStageBadgeClass(c.stage)}>{STAGE_LABELS[c.stage]}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                        ${(c.estimatedExposure / 1000000).toFixed(2)}M
                      </td>
                      <td className="td-secondary">{c.assignedLead}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSelectCase(c.id)}
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          Open Dossier →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE NEW CASE MODAL ── */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📁 Open Formal Investigation Case</div>
              <button className="modal-close-btn" onClick={() => setCreateModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateNewCase}>
              <div className="modal-body">
                <div>
                  <label className="sar-field-label">Investigation Case Title</label>
                  <input
                    type="text"
                    className="note-textarea"
                    style={{ minHeight: 'auto', padding: '0.6rem 0.8rem' }}
                    placeholder="e.g. Coordinated Cross-Market Spoofing Ring"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="sar-field-label">Target Trader ID</label>
                    <input
                      type="text"
                      className="note-textarea"
                      style={{ minHeight: 'auto', padding: '0.6rem 0.8rem' }}
                      value={newTraderId}
                      onChange={(e) => setNewTraderId(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="sar-field-label">Target Trader Name</label>
                    <input
                      type="text"
                      className="note-textarea"
                      style={{ minHeight: 'auto', padding: '0.6rem 0.8rem' }}
                      value={newTraderName}
                      onChange={(e) => setNewTraderName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="sar-field-label">Trading Desk</label>
                    <select
                      className="filter-select"
                      style={{ width: '100%' }}
                      value={newDesk}
                      onChange={(e) => setNewDesk(e.target.value)}
                    >
                      <option value="Crypto Derivatives">Crypto Derivatives</option>
                      <option value="Equities">Equities</option>
                      <option value="FX & Rates">FX & Rates</option>
                      <option value="Commodities">Commodities</option>
                      <option value="Fixed Income">Fixed Income</option>
                    </select>
                  </div>
                  <div>
                    <label className="sar-field-label">Case Priority</label>
                    <select
                      className="filter-select"
                      style={{ width: '100%' }}
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as CasePriority)}
                    >
                      <option value="CRITICAL">Critical Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="LOW">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="sar-field-label">Estimated Financial Exposure ($)</label>
                  <input
                    type="number"
                    className="note-textarea"
                    style={{ minHeight: 'auto', padding: '0.6rem 0.8rem' }}
                    value={newExposure}
                    onChange={(e) => setNewExposure(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="sar-field-label">Initial Supervisory Hypothesis</label>
                  <textarea
                    className="note-textarea"
                    placeholder="Describe suspicious behavior pattern, affected instruments, and anomalous execution timestamps..."
                    value={newHypothesis}
                    onChange={(e) => setNewHypothesis(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Investigation Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="card empty-state"><div className="empty-state-text">Loading Cases Workspace...</div></div>}>
      <CasesContent />
    </Suspense>
  );
}
