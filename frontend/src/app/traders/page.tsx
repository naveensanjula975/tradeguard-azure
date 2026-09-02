'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/* ─── Types ───────────────────────────────────────────────────────── */
type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type Desk = 'EQUITIES' | 'FX_RATES' | 'COMMODITIES' | 'CRYPTO_DERIVATIVES' | 'FIXED_INCOME';

interface TradeExecution {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  notional: number;
  venue: string;
  isFlagged: boolean;
  flagReason?: string;
}

interface TraderAlert {
  id: string;
  ruleCode: string;
  title: string;
  severity: RiskLevel;
  status: 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'CLOSED';
  score: number;
  timestamp: string;
}

interface ComplianceNote {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  type: 'SAR_FILING' | 'SUPERVISORY_INTERVENTION' | 'INVESTIGATION_NOTE' | 'SYSTEM_FLAG';
  text: string;
}

interface LinkedEntity {
  id: string;
  name: string;
  type: 'OFFSHORE_ACCOUNT' | 'CO_TRADER' | 'SHARED_IP' | 'NOMINEE_ENTITY';
  relationship: string;
  riskScore: number;
  details: string;
}

interface TraderProfile {
  id: string;
  name: string;
  title: string;
  desk: Desk;
  department: string;
  jurisdiction: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskDelta: string;
  isWatchlisted: boolean;
  anomalyVelocity: number;
  volume30D: number;
  cancelRatio: number;
  openAlerts: number;
  closedAlerts: number;
  primaryVenue: string;
  avgLatencyMs: number;
  knownIPs: string[];
  devices: string[];
  riskHistory: { date: string; score: number }[];
  alerts: TraderAlert[];
  trades: TradeExecution[];
  notes: ComplianceNote[];
  network: LinkedEntity[];
}

/* ─── Mock Database ───────────────────────────────────────────────── */
const MOCK_TRADERS: TraderProfile[] = [
  {
    id: 'TRD-0042',
    name: 'Viktor Orlenko',
    title: 'Senior Quantitative Proprietary Trader',
    desk: 'CRYPTO_DERIVATIVES',
    department: 'Global Macro & Digital Assets',
    jurisdiction: 'Ukraine / Cyprus / London',
    riskScore: 94,
    riskLevel: 'CRITICAL',
    riskDelta: '+18% vs 30D avg',
    isWatchlisted: true,
    anomalyVelocity: 9.2,
    volume30D: 48500000,
    cancelRatio: 0.88,
    openAlerts: 18,
    closedAlerts: 7,
    primaryVenue: 'Deribit & Binance Futures',
    avgLatencyMs: 14,
    knownIPs: ['185.220.101.47 (TOR)', '194.26.29.112 (Cyprus VPN)', '91.240.118.5'],
    devices: ['DEV-F9A2C1 (Linux / KVM Virtual)', 'DEV-88B109 (MacBook Pro M3)'],
    riskHistory: [
      { date: 'Aug 18', score: 42 },
      { date: 'Aug 20', score: 55 },
      { date: 'Aug 22', score: 68 },
      { date: 'Aug 24', score: 62 },
      { date: 'Aug 26', score: 79 },
      { date: 'Aug 28', score: 86 },
      { date: 'Aug 30', score: 91 },
      { date: 'Sep 01', score: 94 },
    ],
    alerts: [
      { id: 'ALT-9901', ruleCode: 'RULE-SPOOF-01', title: 'Cross-Venue Order Layering & Rapid Cancellation', severity: 'CRITICAL', status: 'ESCALATED', score: 96, timestamp: '12 min ago' },
      { id: 'ALT-9874', ruleCode: 'RULE-OFFHOURS-03', title: 'Unusual Midnight Trading Vol with Anonymized IP', severity: 'HIGH', status: 'UNDER_REVIEW', score: 84, timestamp: '2 hours ago' },
      { id: 'ALT-9721', ruleCode: 'RULE-WASH-02', title: 'Circular Fill Execution with Sub-Account ACC-8812', severity: 'CRITICAL', status: 'CONFIRMED', score: 92, timestamp: '1 day ago' },
      { id: 'ALT-9540', ruleCode: 'RULE-VOL-SPIKE-01', title: 'Notional Position Size Exceeded 4.5x Trader Tier Limit', severity: 'MEDIUM', status: 'CLOSED', score: 65, timestamp: '3 days ago' },
    ],
    trades: [
      { id: 'TX-7701', timestamp: '13:42:10', symbol: 'BTC-USDT-PERP', side: 'BUY', quantity: 150, price: 64250.0, notional: 9637500, venue: 'Deribit', isFlagged: true, flagReason: 'Order book imbalance spoofing' },
      { id: 'TX-7702', timestamp: '13:42:12', symbol: 'BTC-USDT-PERP', side: 'SELL', quantity: 150, price: 64320.0, notional: 9648000, venue: 'Binance', isFlagged: true, flagReason: 'Cross-venue latency arbitrage with nominee' },
      { id: 'TX-7695', timestamp: '12:15:00', symbol: 'ETH-USDT-PERP', side: 'BUY', quantity: 2400, price: 3450.5, notional: 8281200, venue: 'OKX', isFlagged: false },
      { id: 'TX-7688', timestamp: '11:02:44', symbol: 'SOL-USDT', side: 'SELL', quantity: 15000, price: 148.2, notional: 2223000, venue: 'Coinbase Pro', isFlagged: false },
      { id: 'TX-7650', timestamp: '09:20:18', symbol: 'BTC-USDT-PERP', side: 'BUY', quantity: 80, price: 63890.0, notional: 5111200, venue: 'Deribit', isFlagged: true, flagReason: 'Quote stuffing burst (>1200 ops/sec)' },
    ],
    notes: [
      { id: 'NOT-1', author: 'ANALYST-007', role: 'Senior Compliance Officer', timestamp: '2026-08-30 14:15', type: 'SAR_FILING', text: 'FinCEN Suspicious Activity Report (SAR #2026-08-9921) submitted due to recurring cross-venue spoofing and wash executions linked to Redwood Capital offshore proxy.' },
      { id: 'NOT-2', author: 'LEGAL-DESK', role: 'Chief Legal Counsel', timestamp: '2026-08-28 09:30', type: 'SUPERVISORY_INTERVENTION', text: 'Trading limits curtailed to 50% max position. Formal subpoena response submitted to FCA.' },
      { id: 'NOT-3', author: 'SECOPS-001', role: 'Security Ops Analyst', timestamp: '2026-08-25 18:40', type: 'SYSTEM_FLAG', text: 'Detected login originating from Tor Exit node 185.220.101.47 with concurrent session from Cyprus VPS.' },
    ],
    network: [
      { id: 'ACC-8812', name: 'Nominee Sub-Account BVI-4421', type: 'OFFSHORE_ACCOUNT', relationship: 'Direct beneficiary & counterparty', riskScore: 91, details: 'Identical API key routing timestamp and IP subnet.' },
      { id: 'TRD-0089', name: 'Mei-Ling Huang', type: 'CO_TRADER', relationship: 'Correlated order submissions', riskScore: 68, details: '14 synchronized order placement bursts in ETH options.' },
      { id: 'IP-185.220', name: 'Tor Exit Node 185.220.101.47', type: 'SHARED_IP', relationship: 'Anonymized routing gateway', riskScore: 95, details: 'Shared by 3 independent trader profiles simultaneously.' },
    ],
  },
  {
    id: 'TRD-0089',
    name: 'Mei-Ling Huang',
    title: 'HFT Algorithm Specialist',
    desk: 'EQUITIES',
    department: 'APAC Automated Execution',
    jurisdiction: 'Hong Kong / Singapore',
    riskScore: 68,
    riskLevel: 'HIGH',
    riskDelta: '+6% vs 30D avg',
    isWatchlisted: true,
    anomalyVelocity: 6.4,
    volume30D: 92400000,
    cancelRatio: 0.94,
    openAlerts: 4,
    closedAlerts: 12,
    primaryVenue: 'HKEX & SGX Colocation',
    avgLatencyMs: 3.2,
    knownIPs: ['202.64.12.88 (HK Colo)', '218.102.44.19'],
    devices: ['DEV-HK-001 (Colo Blade 4)', 'DEV-HK-002 (Colo Blade 5)'],
    riskHistory: [
      { date: 'Aug 18', score: 50 },
      { date: 'Aug 20', score: 52 },
      { date: 'Aug 22', score: 58 },
      { date: 'Aug 24', score: 65 },
      { date: 'Aug 26', score: 60 },
      { date: 'Aug 28', score: 64 },
      { date: 'Aug 30', score: 71 },
      { date: 'Sep 01', score: 68 },
    ],
    alerts: [
      { id: 'ALT-8810', ruleCode: 'RULE-HFT-CANCEL-04', title: 'Excessive Cancel-to-Fill Ratio (>94%) during Market Open', severity: 'HIGH', status: 'UNDER_REVIEW', score: 76, timestamp: '1 hour ago' },
      { id: 'ALT-8790', ruleCode: 'RULE-MKT-IMPACT-01', title: 'Quote Stuffing Surge on 0700.HK', severity: 'HIGH', status: 'ESCALATED', score: 72, timestamp: 'Yesterday' },
      { id: 'ALT-8430', ruleCode: 'RULE-FRONT-RUN-02', title: 'Pre-Hedging Detected Before Client Block Order', severity: 'MEDIUM', status: 'UNDER_REVIEW', score: 58, timestamp: '4 days ago' },
    ],
    trades: [
      { id: 'TX-601', timestamp: '09:30:02', symbol: '0700.HK', side: 'BUY', quantity: 20000, price: 382.4, notional: 7648000, venue: 'HKEX', isFlagged: true, flagReason: 'Cancel ratio 96% in 200ms' },
      { id: 'TX-602', timestamp: '09:30:03', symbol: '0700.HK', side: 'SELL', quantity: 20000, price: 382.8, notional: 7656000, venue: 'HKEX', isFlagged: false },
      { id: 'TX-590', timestamp: '09:28:14', symbol: '9988.HK', side: 'BUY', quantity: 50000, price: 78.5, notional: 3925000, venue: 'HKEX', isFlagged: false },
    ],
    notes: [
      { id: 'NOT-10', author: 'COMP-002', role: 'APAC Compliance Lead', timestamp: '2026-08-29 11:20', type: 'INVESTIGATION_NOTE', text: 'Second inquiry regarding algorithm parameters for 0700.HK opening auction strategy. Parameter adjustments requested.' },
    ],
    network: [
      { id: 'TRD-0042', name: 'Viktor Orlenko', type: 'CO_TRADER', relationship: 'Cross-product hedge coordination', riskScore: 94, details: 'Linked via digital assets arbitrage correlation.' },
    ],
  },
  {
    id: 'TRD-0115',
    name: 'Marcus Vance',
    title: 'Senior FX & Sovereign Debt Trader',
    desk: 'FX_RATES',
    department: 'Fixed Income & Currencies',
    jurisdiction: 'New York, US',
    riskScore: 82,
    riskLevel: 'CRITICAL',
    riskDelta: '+24% vs 30D avg',
    isWatchlisted: true,
    anomalyVelocity: 8.1,
    volume30D: 184000000,
    cancelRatio: 0.42,
    openAlerts: 8,
    closedAlerts: 15,
    primaryVenue: 'EBS & Refinitiv FXall',
    avgLatencyMs: 45,
    knownIPs: ['12.180.44.10 (NY Desk)', '68.195.12.99'],
    devices: ['DEV-NY-BLOM-09 (Bloomberg Terminal)', 'DEV-NY-MOB-44'],
    riskHistory: [
      { date: 'Aug 18', score: 38 },
      { date: 'Aug 20', score: 44 },
      { date: 'Aug 22', score: 52 },
      { date: 'Aug 24', score: 61 },
      { date: 'Aug 26', score: 70 },
      { date: 'Aug 28', score: 78 },
      { date: 'Aug 30', score: 85 },
      { date: 'Sep 01', score: 82 },
    ],
    alerts: [
      { id: 'ALT-7712', ruleCode: 'RULE-WMR-FIX-01', title: 'Aggressive Bidding 45 Seconds Prior to 4PM WMR London Fix', severity: 'CRITICAL', status: 'ESCALATED', score: 91, timestamp: '3 hours ago' },
      { id: 'ALT-7690', ruleCode: 'RULE-FRONT-RUN-01', title: 'Personal Account EUR/USD Trading Before Sovereign Flow', severity: 'CRITICAL', status: 'CONFIRMED', score: 88, timestamp: '1 day ago' },
      { id: 'ALT-7510', ruleCode: 'RULE-CHAT-FLAGS-03', title: 'Flagged Bloomberg Chat Collusion Terminology ("push the fix")', severity: 'HIGH', status: 'UNDER_REVIEW', score: 80, timestamp: '2 days ago' },
    ],
    trades: [
      { id: 'TX-4401', timestamp: '15:59:15', symbol: 'EUR/USD', side: 'BUY', quantity: 50000000, price: 1.0845, notional: 54225000, venue: 'EBS', isFlagged: true, flagReason: 'Fix window concentration' },
      { id: 'TX-4402', timestamp: '16:01:10', symbol: 'EUR/USD', side: 'SELL', quantity: 50000000, price: 1.0858, notional: 54290000, venue: 'EBS', isFlagged: true, flagReason: 'Immediate post-fix liquidation' },
    ],
    notes: [
      { id: 'NOT-21', author: 'LEGAL-US', role: 'Head of Regulatory Investigations', timestamp: '2026-08-31 16:30', type: 'SAR_FILING', text: 'CFTC benchmark manipulation investigation inquiry received. Communications logs and order timestamps preserved under legal hold.' },
    ],
    network: [
      { id: 'INST-CLD-229', name: 'Cleardale Capital Mgmt.', type: 'NOMINEE_ENTITY', relationship: 'External client counterparty in fixing window', riskScore: 89, details: 'Client orders routed matching personal account direction.' },
    ],
  },
  {
    id: 'TRD-0204',
    name: 'Elena Rostova',
    title: 'Commodities Index Arbitrage Trader',
    desk: 'COMMODITIES',
    department: 'Energy & Metals',
    jurisdiction: 'Geneva / Dubai',
    riskScore: 54,
    riskLevel: 'MEDIUM',
    riskDelta: '-4% vs 30D avg',
    isWatchlisted: false,
    anomalyVelocity: 4.1,
    volume30D: 76000000,
    cancelRatio: 0.35,
    openAlerts: 2,
    closedAlerts: 18,
    primaryVenue: 'ICE & CME Globex',
    avgLatencyMs: 62,
    knownIPs: ['195.176.4.12 (Geneva Office)', '94.200.11.8 (Dubai)'],
    devices: ['DEV-GEN-04 (ThinkPad Workstation)'],
    riskHistory: [
      { date: 'Aug 18', score: 62 },
      { date: 'Aug 20', score: 58 },
      { date: 'Aug 22', score: 55 },
      { date: 'Aug 24', score: 57 },
      { date: 'Aug 26', score: 50 },
      { date: 'Aug 28', score: 52 },
      { date: 'Aug 30', score: 56 },
      { date: 'Sep 01', score: 54 },
    ],
    alerts: [
      { id: 'ALT-6610', ruleCode: 'RULE-SPREAD-02', title: 'Brent/WTI Spread Position Sizing Warning', severity: 'MEDIUM', status: 'CLOSED', score: 54, timestamp: '3 days ago' },
      { id: 'ALT-6520', ruleCode: 'RULE-LIMIT-01', title: 'Expiry Day Rollover Position Exceeded Desk Cap', severity: 'MEDIUM', status: 'UNDER_REVIEW', score: 51, timestamp: '5 days ago' },
    ],
    trades: [
      { id: 'TX-3301', timestamp: '14:10:00', symbol: 'BRENT-OCT26', side: 'BUY', quantity: 200, price: 82.4, notional: 1648000, venue: 'ICE', isFlagged: false },
      { id: 'TX-3302', timestamp: '14:10:05', symbol: 'WTI-OCT26', side: 'SELL', quantity: 200, price: 78.1, notional: 1562000, venue: 'CME', isFlagged: false },
    ],
    notes: [
      { id: 'NOT-31', author: 'RISK-DESK', role: 'Commodities Risk Controller', timestamp: '2026-08-20 10:00', type: 'INVESTIGATION_NOTE', text: 'Spread positions verified against physical delivery hedging exemption.' },
    ],
    network: [],
  },
  {
    id: 'TRD-0310',
    name: 'Sarah Jenkins',
    title: 'US High Yield Bond Market Maker',
    desk: 'FIXED_INCOME',
    department: 'Credit Trading',
    jurisdiction: 'New York, US',
    riskScore: 28,
    riskLevel: 'LOW',
    riskDelta: '-12% vs 30D avg',
    isWatchlisted: false,
    anomalyVelocity: 1.8,
    volume30D: 52000000,
    cancelRatio: 0.18,
    openAlerts: 0,
    closedAlerts: 24,
    primaryVenue: 'MarketAxess & Tradeweb',
    avgLatencyMs: 120,
    knownIPs: ['12.180.44.80 (NY HQ)'],
    devices: ['DEV-NY-HY-02'],
    riskHistory: [
      { date: 'Aug 18', score: 32 },
      { date: 'Aug 20', score: 30 },
      { date: 'Aug 22', score: 28 },
      { date: 'Aug 24', score: 29 },
      { date: 'Aug 26', score: 26 },
      { date: 'Aug 28', score: 27 },
      { date: 'Aug 30', score: 28 },
      { date: 'Sep 01', score: 28 },
    ],
    alerts: [],
    trades: [
      { id: 'TX-2001', timestamp: '10:15:30', symbol: 'F-5.875-2029', side: 'BUY', quantity: 2000000, price: 99.25, notional: 1985000, venue: 'MarketAxess', isFlagged: false },
      { id: 'TX-2002', timestamp: '11:40:12', symbol: 'GM-6.125-2030', side: 'SELL', quantity: 1500000, price: 101.1, notional: 1516500, venue: 'Tradeweb', isFlagged: false },
    ],
    notes: [
      { id: 'NOT-40', author: 'ANALYST-007', role: 'Compliance Officer', timestamp: '2026-08-15 09:00', type: 'INVESTIGATION_NOTE', text: 'Annual trader audit completed with no discrepancies found.' },
    ],
    network: [],
  },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function getSeverityBadgeClass(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    case 'LOW': return 'badge badge-low';
  }
}

function getRiskBarColor(score: number): string {
  if (score >= 80) return 'var(--danger)';
  if (score >= 60) return 'var(--warning)';
  if (score >= 40) return 'var(--accent)';
  return 'var(--success)';
}

function formatDeskName(desk: Desk): string {
  return desk.replace(/_/g, ' ');
}

/* ─── Trader Profile Main Component ───────────────────────────────── */
function TraderProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get('id');

  const [selectedTraderId, setSelectedTraderId] = useState<string | null>(initialId);
  const [traders, setTraders] = useState<TraderProfile[]>(MOCK_TRADERS);

  // Filters for directory
  const [searchQuery, setSearchQuery] = useState('');
  const [deskFilter, setDeskFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [watchlistFilter, setWatchlistFilter] = useState<string>('ALL');

  // Detail view state
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ALERTS' | 'TRADES' | 'NETWORK' | 'DOSSIER'>('OVERVIEW');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<ComplianceNote['type']>('INVESTIGATION_NOTE');
  const [alertSuccessMsg, setAlertSuccessMsg] = useState<string | null>(null);

  // Sync selectedTraderId with query param
  useEffect(() => {
    if (initialId) {
      setSelectedTraderId(initialId);
    }
  }, [initialId]);

  const selectedTrader = useMemo(() => {
    if (!selectedTraderId) return null;
    return traders.find((t) => t.id === selectedTraderId) || traders[0];
  }, [selectedTraderId, traders]);

  const filteredTraders = useMemo(() => {
    return traders.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desk.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDesk = deskFilter === 'ALL' || t.desk === deskFilter;
      const matchesRisk = riskFilter === 'ALL' || t.riskLevel === riskFilter;
      const matchesWatchlist =
        watchlistFilter === 'ALL' ||
        (watchlistFilter === 'WATCHLISTED' && t.isWatchlisted) ||
        (watchlistFilter === 'STANDARD' && !t.isWatchlisted);

      return matchesSearch && matchesDesk && matchesRisk && matchesWatchlist;
    });
  }, [traders, searchQuery, deskFilter, riskFilter, watchlistFilter]);

  const handleSelectTrader = (id: string) => {
    setSelectedTraderId(id);
    router.push(`/traders?id=${id}`);
  };

  const handleBackToDirectory = () => {
    setSelectedTraderId(null);
    router.push('/traders');
  };

  const handleToggleWatchlist = (traderId: string) => {
    setTraders((prev) =>
      prev.map((t) => {
        if (t.id === traderId) {
          const next = !t.isWatchlisted;
          setAlertSuccessMsg(
            next
              ? `Trader ${t.name} (${t.id}) added to Enhanced Surveillance Watchlist`
              : `Trader ${t.name} removed from Watchlist`
          );
          setTimeout(() => setAlertSuccessMsg(null), 4000);
          return { ...t, isWatchlisted: next };
        }
        return t;
      })
    );
  };

  const handleAddComplianceNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedTrader) return;

    const newNote: ComplianceNote = {
      id: `NOT-${Date.now()}`,
      author: 'COMPLIANCE-LEAD',
      role: 'Supervisory Officer',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      type: newNoteType,
      text: newNoteText.trim(),
    };

    setTraders((prev) =>
      prev.map((t) => {
        if (t.id === selectedTrader.id) {
          return { ...t, notes: [newNote, ...t.notes] };
        }
        return t;
      })
    );

    setNewNoteText('');
    setAlertSuccessMsg('Compliance case note officially registered in audit log.');
    setTimeout(() => setAlertSuccessMsg(null), 3500);
  };

  /* ──────────────────────────────────────────────────────────────────
     RENDER: DEEP PROFILE VIEW
     ────────────────────────────────────────────────────────────────── */
  if (selectedTrader) {
    const t = selectedTrader;
    const riskColor = getRiskBarColor(t.riskScore);

    // SVG Chart Points
    const chartWidth = 700;
    const chartHeight = 180;
    const paddingX = 40;
    const paddingY = 25;
    const points = t.riskHistory.map((item, index) => {
      const x = paddingX + (index / (t.riskHistory.length - 1)) * (chartWidth - paddingX * 2);
      const y = chartHeight - paddingY - (item.score / 100) * (chartHeight - paddingY * 2);
      return { x, y, score: item.score, date: item.date };
    });

    const pathString = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
    const areaString = `${pathString} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

    return (
      <div className="fade-in">
        {/* Top Breadcrumb / Action */}
        <div className="trader-top-nav">
          <button className="trader-back-btn" onClick={handleBackToDirectory}>
            <span>←</span> Back to Trader Directory
          </button>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quick Jump:</span>
            <select
              className="filter-select"
              value={t.id}
              onChange={(e) => handleSelectTrader(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {traders.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({tr.id}) — {tr.riskScore}/100
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Success Alert Banner */}
        {alertSuccessMsg && (
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
            <span>✓</span> {alertSuccessMsg}
          </div>
        )}

        {/* Trader Hero Header */}
        <div className="trader-hero">
          <div className="trader-hero-content">
            <div className="trader-identity">
              <div className="trader-avatar-large">
                {t.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <div className="trader-hero-title">
                  <span>{t.name}</span>
                  <span className="trader-id-tag">{t.id}</span>
                  <span className={getSeverityBadgeClass(t.riskLevel)}>{t.riskLevel} RISK</span>
                  {t.isWatchlisted && (
                    <span
                      className="badge badge-critical"
                      style={{ background: 'rgba(244,63,94,0.2)', border: '1px solid var(--danger)' }}
                    >
                      👁️ WATCHLISTED
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {t.title} · <strong style={{ color: 'var(--accent)' }}>{formatDeskName(t.desk)}</strong>
                </div>
                <div className="trader-meta-row">
                  <div className="trader-meta-item">
                    <span>🏢</span> {t.department}
                  </div>
                  <div className="trader-meta-item">
                    <span>🌍</span> {t.jurisdiction}
                  </div>
                  <div className="trader-meta-item">
                    <span>⚡</span> Avg Latency: <strong style={{ color: 'var(--text-primary)' }}>{t.avgLatencyMs}ms</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Hero Actions */}
            <div className="trader-hero-actions">
              <button
                className={`btn ${t.isWatchlisted ? 'btn-ghost' : 'btn-warning'}`}
                onClick={() => handleToggleWatchlist(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>{t.isWatchlisted ? '★ Watchlisted' : '☆ Add to Watchlist'}</span>
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setActiveTab('DOSSIER');
                  setNewNoteType('SAR_FILING');
                  setNewNoteText(`[SAR INITIATION] Formal FinCEN SAR filing draft opened for trader ${t.name} (${t.id}).`);
                }}
              >
                🚨 File SAR / FinCEN
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  alert(`Exporting official compliance audit dossier for ${t.name} (${t.id})... Download initiated.`);
                }}
              >
                📥 Export Dossier
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Metrics Grid ── */}
        <div className="trader-kpi-grid">
          {/* Card 1: Risk Score */}
          <div className="trader-kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Risk Telemetry Score</span>
              <span className="kpi-icon">🎯</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-number" style={{ color: riskColor }}>
                {t.riskScore}
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
              </span>
              <span
                className="kpi-delta"
                style={{ color: t.riskDelta.startsWith('+') ? 'var(--danger)' : 'var(--success)' }}
              >
                {t.riskDelta}
              </span>
            </div>
            <div className="risk-gauge-wrap">
              <div
                className="risk-gauge-fill"
                style={{ width: `${t.riskScore}%`, background: riskColor }}
              />
            </div>
            <div className="kpi-subtext">Composite ML Anomaly + Rule Severity</div>
          </div>

          {/* Card 2: Anomaly Velocity */}
          <div className="trader-kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Anomaly Velocity</span>
              <span className="kpi-icon">⚡</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-number" style={{ color: 'var(--accent)' }}>
                {t.anomalyVelocity}
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/10</span>
              </span>
              <span className="kpi-delta" style={{ color: 'var(--accent)' }}>
                High Spike
              </span>
            </div>
            <div className="risk-gauge-wrap">
              <div
                className="risk-gauge-fill"
                style={{ width: `${t.anomalyVelocity * 10}%`, background: 'var(--accent)' }}
              />
            </div>
            <div className="kpi-subtext">Frequency of deviant execution bursts</div>
          </div>

          {/* Card 3: 30D Traded Volume */}
          <div className="trader-kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">30-Day Traded Volume</span>
              <span className="kpi-icon">💰</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-number">
                ${(t.volume30D / 1000000).toFixed(1)}M
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Cancel-to-Fill: <strong style={{ color: t.cancelRatio > 0.8 ? 'var(--danger)' : 'var(--text-primary)' }}>{(t.cancelRatio * 100).toFixed(0)}%</strong>
            </div>
            <div className="kpi-subtext">Gross notional value across all venues</div>
          </div>

          {/* Card 4: Open Incidents */}
          <div className="trader-kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Alerts & Incidents</span>
              <span className="kpi-icon">🚨</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-number" style={{ color: t.openAlerts > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {t.openAlerts}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({t.closedAlerts} Resolved)
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              SAR Filings: <strong style={{ color: 'var(--danger)' }}>{t.notes.filter(n => n.type === 'SAR_FILING').length}</strong>
            </div>
            <div className="kpi-subtext">Active investigations requiring compliance review</div>
          </div>
        </div>

        {/* ── Tabbed Interface ── */}
        <div className="trader-tabs-bar">
          <button
            className={`trader-tab-btn ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('OVERVIEW')}
          >
            <span>📈</span> Risk & Telemetry Timeline
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'ALERTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALERTS')}
          >
            <span>🚨</span> Alert History
            <span className="tab-badge">{t.alerts.length}</span>
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'TRADES' ? 'active' : ''}`}
            onClick={() => setActiveTab('TRADES')}
          >
            <span>📊</span> Trade Execution Log
            <span className="tab-badge">{t.trades.length}</span>
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'NETWORK' ? 'active' : ''}`}
            onClick={() => setActiveTab('NETWORK')}
          >
            <span>🕸️</span> Network & Linked Entities
            <span className="tab-badge">{t.network.length}</span>
          </button>
          <button
            className={`trader-tab-btn ${activeTab === 'DOSSIER' ? 'active' : ''}`}
            onClick={() => setActiveTab('DOSSIER')}
          >
            <span>📜</span> Compliance Dossier & Case Notes
            <span className="tab-badge">{t.notes.length}</span>
          </button>
        </div>

        {/* ── TAB CONTENT ── */}

        {/* TAB 1: OVERVIEW & TELEMETRY */}
        {activeTab === 'OVERVIEW' && (
          <div className="fade-in">
            {/* SVG Risk Score Trend */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="section-header">
                <div>
                  <h3 className="section-title">14-Day Risk Trajectory & Anomaly Surges</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Continuous machine learning anomaly scoring evaluated per order submission
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 10, height: 3, background: 'var(--accent)', display: 'inline-block' }} />
                    <span>Risk Score</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                    <span>Critical Alert Trigger</span>
                  </div>
                </div>
              </div>

              {/* Interactive SVG Chart */}
              <div className="chart-container">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  {[25, 50, 75, 100].map((gridScore) => {
                    const y = chartHeight - paddingY - (gridScore / 100) * (chartHeight - paddingY * 2);
                    return (
                      <g key={gridScore}>
                        <line
                          x1={paddingX}
                          y1={y}
                          x2={chartWidth - paddingX}
                          y2={y}
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={paddingX - 10}
                          y={y + 3}
                          fill="var(--text-muted)"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {gridScore}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  <path d={areaString} fill="url(#riskAreaGrad)" />

                  {/* Line stroke */}
                  <path
                    d={pathString}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Points */}
                  {points.map((pt, idx) => (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={pt.score >= 80 ? 5 : 3.5}
                        fill={pt.score >= 80 ? 'var(--danger)' : 'var(--accent)'}
                        stroke="#080d1a"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={chartHeight - 6}
                        fill="var(--text-muted)"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {pt.date}
                      </text>
                      <text
                        x={pt.x}
                        y={pt.y - 8}
                        fill={pt.score >= 80 ? '#fb7185' : 'var(--text-primary)'}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {pt.score}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Behavioral Telemetry Grid */}
            <div className="telemetry-grid">
              {/* Box 1: Network & Infrastructure */}
              <div className="telemetry-card">
                <div className="telemetry-title">
                  <span>🌐</span> Network & Access Telemetry
                </div>
                <div className="telemetry-item-row">
                  <span className="telemetry-label">Primary Venue</span>
                  <span className="telemetry-val">{t.primaryVenue}</span>
                </div>
                <div className="telemetry-item-row">
                  <span className="telemetry-label">Execution Colocation</span>
                  <span className="telemetry-val">{t.avgLatencyMs < 10 ? 'Ultra-low Colocated' : 'Cross-Region Transit'}</span>
                </div>
                <div className="telemetry-item-row">
                  <span className="telemetry-label">Active IPs Logged</span>
                  <div style={{ textAlign: 'right' }}>
                    {t.knownIPs.map((ip, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: ip.includes('TOR') ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {ip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Box 2: Fingerprints & Devices */}
              <div className="telemetry-card">
                <div className="telemetry-title">
                  <span>💻</span> Terminal & Hardware Fingerprints
                </div>
                <div className="telemetry-item-row">
                  <span className="telemetry-label">Authorized Devices</span>
                  <span className="telemetry-val">{t.devices.length} Active Hardware UUIDs</span>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  {t.devices.map((dev, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        fontSize: '0.75rem',
                        marginBottom: '0.35rem',
                        fontFamily: 'monospace',
                        color: dev.includes('Virtual') ? 'var(--warning)' : 'var(--text-secondary)',
                      }}
                    >
                      {dev}
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 3: Regulatory & Behavioral Red Flags */}
              <div className="telemetry-card">
                <div className="telemetry-title">
                  <span>⚠️</span> Active Surveillance Flags
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: t.cancelRatio > 0.8 ? '#fb7185' : 'var(--text-secondary)' }}>
                    <span>{t.cancelRatio > 0.8 ? '❌' : '✓'}</span> High Order Cancellation Ratio ({Math.round(t.cancelRatio * 100)}%)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: t.knownIPs.some(ip => ip.includes('TOR')) ? '#fb7185' : 'var(--text-secondary)' }}>
                    <span>{t.knownIPs.some(ip => ip.includes('TOR')) ? '❌' : '✓'}</span> Anonymizing Proxy / Tor Traffic
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: t.riskScore >= 80 ? '#fb7185' : 'var(--text-secondary)' }}>
                    <span>{t.riskScore >= 80 ? '❌' : '✓'}</span> ML Anomaly Velocity Exceeded 99th Percentile
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ALERT HISTORY */}
        {activeTab === 'ALERTS' && (
          <div className="card fade-in">
            <div className="section-header">
              <div>
                <h3 className="section-title">Surveillance Alerts Triggered ({t.alerts.length})</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  All rule violations and machine learning anomaly triggers logged for this trader
                </p>
              </div>
              <Link href={`/alerts?trader_id=${t.id}`} className="btn btn-ghost btn-sm">
                Open in Full Alert Desk →
              </Link>
            </div>

            {t.alerts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No surveillance alerts recorded for this trader. Clean record.</div>
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
                      <th>Status</th>
                      <th>Time</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{alert.id}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {alert.ruleCode}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{alert.title}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: getRiskBarColor(alert.score) }}>
                            {alert.score}
                          </span>
                        </td>
                        <td>
                          <span className={getSeverityBadgeClass(alert.severity)}>{alert.severity}</span>
                        </td>
                        <td>
                          <span className={`badge badge-${alert.status.toLowerCase().replace('_', '-')}`}>
                            {alert.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="td-secondary">{alert.timestamp}</td>
                        <td>
                          <Link href={`/alerts?id=${alert.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRADES LOG */}
        {activeTab === 'TRADES' && (
          <div className="card fade-in">
            <div className="section-header">
              <div>
                <h3 className="section-title">Recent Simulated & Executed Orders ({t.trades.length})</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Granular order routing, exchange fill telemetry, and real-time anomaly detection status
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                  {t.trades.filter((tr) => tr.isFlagged).length} Flagged Trades
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Execution ID</th>
                    <th>Time</th>
                    <th>Instrument</th>
                    <th>Side</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Notional ($)</th>
                    <th>Venue</th>
                    <th>Surveillance Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {t.trades.map((tx) => (
                    <tr
                      key={tx.id}
                      style={{
                        background: tx.isFlagged ? 'rgba(244,63,94,0.05)' : undefined,
                      }}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{tx.id}</td>
                      <td className="td-secondary">{tx.timestamp}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tx.symbol}</td>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            background: tx.side === 'BUY' ? 'var(--success-dim)' : 'var(--danger-dim)',
                            color: tx.side === 'BUY' ? 'var(--success)' : 'var(--danger)',
                          }}
                        >
                          {tx.side}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{tx.quantity.toLocaleString()}</td>
                      <td style={{ fontFamily: 'monospace' }}>${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 600 }}>${tx.notional.toLocaleString()}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.venue}</td>
                      <td>
                        {tx.isFlagged ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fb7185', fontSize: '0.78rem' }}>
                            <span>⚠️</span> {tx.flagReason}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>✓ Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: NETWORK & LINKED ENTITIES */}
        {activeTab === 'NETWORK' && (
          <div className="fade-in">
            <div className="section-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 className="section-title">Co-Conspirator & Counterparty Network Graph</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Entity relationships discovered via shared IP sessions, synchronized order book bursts, and nominee accounts
                </p>
              </div>
            </div>

            {t.network.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">🛡️</div>
                <div className="empty-state-text">No anomalous entity relationships or co-conspirators detected.</div>
              </div>
            ) : (
              <div className="network-grid">
                {t.network.map((item) => (
                  <div key={item.id} className="network-card">
                    <div className="network-card-header">
                      <span className="network-type-badge">{item.type.replace(/_/g, ' ')}</span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: getRiskBarColor(item.riskScore),
                        }}
                      >
                        Risk: {item.riskScore}/100
                      </span>
                    </div>
                    <div className="network-entity-name">{item.name}</div>
                    <div className="network-relation">🔗 {item.relationship}</div>
                    <div className="network-desc">{item.details}</div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/watchlist`} className="btn btn-ghost btn-sm">
                        View in Watchlist →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COMPLIANCE DOSSIER & NOTES */}
        {activeTab === 'DOSSIER' && (
          <div className="fade-in">
            {/* Add Note Form */}
            <div className="compliance-note-form">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                📝 Register Compliance Observation / Investigation Note
              </h4>
              <form onSubmit={handleAddComplianceNote}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <select
                    className="filter-select"
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value as ComplianceNote['type'])}
                  >
                    <option value="INVESTIGATION_NOTE">🔍 General Investigation Note</option>
                    <option value="SAR_FILING">🚨 FinCEN SAR Filing Record</option>
                    <option value="SUPERVISORY_INTERVENTION">⚖️ Supervisory Intervention / Curtailment</option>
                    <option value="SYSTEM_FLAG">⚠️ Security & Hardware Alert</option>
                  </select>
                </div>
                <textarea
                  className="note-textarea"
                  placeholder="Document supervisory inquiries, suspicious communications review, legal hold notices, or trade explanation provided by trader..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={3}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Register to Audit Dossier
                  </button>
                </div>
              </form>
            </div>

            {/* Notes Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {t.notes.map((note) => (
                <div key={note.id} className="note-item" style={{ borderLeftColor: note.type === 'SAR_FILING' ? 'var(--danger)' : 'var(--accent)' }}>
                  <div className="note-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="note-author">{note.author}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({note.role})</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: 4,
                          background: note.type === 'SAR_FILING' ? 'var(--danger-dim)' : 'rgba(255,255,255,0.05)',
                          color: note.type === 'SAR_FILING' ? 'var(--danger)' : 'var(--text-secondary)',
                        }}
                      >
                        {note.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="note-time">{note.timestamp}</span>
                  </div>
                  <div className="note-body">{note.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────
     RENDER: ALL TRADERS DIRECTORY VIEW
     ────────────────────────────────────────────────────────────────── */
  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Trader Risk Profiles</h1>
            <p className="page-subtitle">Comprehensive directory, machine learning risk scoring, and behavioural surveillance</p>
          </div>
          <div className="live-badge">
            <span className="live-dot" />
            {traders.length} Monitored Traders
          </div>
        </div>
      </div>

      {/* Global Summary Stats */}
      <div className="grid" style={{ marginBottom: '1.75rem' }}>
        <div className="metric-card">
          <div className="card-title">Total Active Traders</div>
          <div className="card-value accent">{traders.length}</div>
          <div className="card-delta">Across 5 Trading Desks</div>
        </div>
        <div className="metric-card">
          <div className="card-title">Critical & High Risk</div>
          <div className="card-value danger">
            {traders.filter((t) => t.riskLevel === 'CRITICAL' || t.riskLevel === 'HIGH').length}
          </div>
          <div className="card-delta">Requiring Active Oversight</div>
        </div>
        <div className="metric-card">
          <div className="card-title">On Watchlist</div>
          <div className="card-value warning">
            {traders.filter((t) => t.isWatchlisted).length}
          </div>
          <div className="card-delta">Enhanced Surveillance Active</div>
        </div>
        <div className="metric-card">
          <div className="card-title">Open Incidents</div>
          <div className="card-value purple">
            {traders.reduce((sum, t) => sum + t.openAlerts, 0)}
          </div>
          <div className="card-delta">Unresolved Alerts</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="trader-filter-bar">
        <div className="search-input-group">
          <span className="search-input-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by Trader Name, ID (e.g. TRD-0042), Desk, or Jurisdiction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="filter-select"
            value={deskFilter}
            onChange={(e) => setDeskFilter(e.target.value)}
          >
            <option value="ALL">All Trading Desks</option>
            <option value="EQUITIES">Equities</option>
            <option value="FX_RATES">FX & Rates</option>
            <option value="COMMODITIES">Commodities</option>
            <option value="CRYPTO_DERIVATIVES">Crypto Derivatives</option>
            <option value="FIXED_INCOME">Fixed Income</option>
          </select>

          <select
            className="filter-select"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk (≥80)</option>
            <option value="HIGH">High Risk (60-79)</option>
            <option value="MEDIUM">Medium Risk (40-59)</option>
            <option value="LOW">Low Risk (&lt;40)</option>
          </select>

          <select
            className="filter-select"
            value={watchlistFilter}
            onChange={(e) => setWatchlistFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="WATCHLISTED">Watchlisted Only</option>
            <option value="STANDARD">Standard Monitoring</option>
          </select>
        </div>
      </div>

      {/* Trader Cards Grid */}
      {filteredTraders.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">No traders found matching the search criteria.</div>
        </div>
      ) : (
        <div className="traders-grid">
          {filteredTraders.map((trader) => {
            const riskColor = getRiskBarColor(trader.riskScore);
            return (
              <div
                key={trader.id}
                className="trader-summary-card"
                onClick={() => handleSelectTrader(trader.id)}
              >
                <div>
                  {/* Top: Avatar, Name, Badges */}
                  <div className="trader-card-top">
                    <div className="trader-card-info">
                      <div className="trader-card-avatar">
                        {trader.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="trader-card-name">{trader.name}</div>
                        <div className="trader-card-desk">
                          {formatDeskName(trader.desk)} · <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{trader.id}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <span className={getSeverityBadgeClass(trader.riskLevel)}>
                        {trader.riskLevel}
                      </span>
                      {trader.isWatchlisted && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 700 }}>
                          👁️ WATCHLIST
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="trader-card-stats">
                    <div className="trader-stat-col">
                      <span className="stat-label">Risk Score</span>
                      <span className="stat-val" style={{ color: riskColor }}>
                        {trader.riskScore}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/100</span>
                      </span>
                    </div>
                    <div className="trader-stat-col">
                      <span className="stat-label">30D Volume</span>
                      <span className="stat-val">
                        ${(trader.volume30D / 1000000).toFixed(1)}M
                      </span>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Anomaly Velocity</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{trader.anomalyVelocity}/10</span>
                    </div>
                    <div className="risk-gauge-wrap">
                      <div
                        className="risk-gauge-fill"
                        style={{ width: `${trader.riskScore}%`, background: riskColor }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="trader-card-footer">
                  <div style={{ fontSize: '0.75rem', color: trader.openAlerts > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {trader.openAlerts > 0 ? `🚨 ${trader.openAlerts} open alerts` : '✓ No active alerts'}
                  </div>
                  <span className="view-profile-btn">
                    Inspect Profile →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TradersPage() {
  return (
    <Suspense fallback={<div className="card empty-state"><div className="empty-state-text">Loading Trader Profile...</div></div>}>
      <TraderProfileContent />
    </Suspense>
  );
}
