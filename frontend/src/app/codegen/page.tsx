'use client';

import { useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type TemplateKind = 'threshold' | 'count_window' | 'time_range' | 'ratio' | 'context_flag';
type Operator = '>=' | '>' | '<=' | '<' | '==';

interface Identity {
  ruleName: string;
  description: string;
  severity: Severity;
  score: number;
}

interface Detection {
  template: TemplateKind;
  // Threshold / Ratio
  field: string;
  operator: Operator;
  threshold: string;
  // Count window
  windowSecs: string;
  countThreshold: string;
  // Time range
  startHour: string;
  endHour: string;
  valueField: string;
  valueThreshold: string;
  // Ratio
  refField: string;
  ratio: string;
  // Context flag
  flagKey: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toScreamingSnake(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toPascalCase(s: string): string {
  return s
    .trim()
    .split(/[\s_\-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') + 'Rule';
}

function toFileName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '.py';
}

const SEVERITY_SCORE_MAP: Record<Severity, number> = {
  LOW: 30, MEDIUM: 55, HIGH: 75, CRITICAL: 90,
};

// ─── Code Generator ──────────────────────────────────────────────────────────

function generateCode(identity: Identity, detection: Detection): string {
  const code  = toScreamingSnake(identity.ruleName) || 'CUSTOM_RULE';
  const cls   = toPascalCase(identity.ruleName)     || 'CustomRule';
  const sev   = identity.severity;
  const desc  = identity.description.replace(/"/g, '\\"') || 'Custom risk rule';
  const score = identity.score.toFixed(1);

  const baseImports = [
    'from typing import Optional, Tuple',
    'from shared.event_contracts import TradeEvent',
    'from shared.schemas import AlertSeverity',
    'from .base import BaseRiskRule',
  ];
  let extraImports: string[] = [];
  let evaluateBody = '';

  switch (detection.template) {
    case 'threshold': {
      const f   = detection.field     || 'order_value';
      const op  = detection.operator  || '>=';
      const thr = detection.threshold || '100000.0';
      const label = f.replace(/_/g, ' ');
      evaluateBody = [
        '        value = event.' + f,
        '        threshold = context.get("threshold", ' + thr + ') if context else ' + thr,
        '        if value ' + op + ' threshold:',
        '            return (',
        '                True,',
        '                self.default_score,',
        '                f"' + label + ' {value:,.2f} ' + op + ' threshold {threshold:,.2f}"',
        '            )',
        '        return False, 0.0, None',
      ].join('\n');
      break;
    }
    case 'count_window': {
      const win   = detection.windowSecs     || '300';
      const count = detection.countThreshold || '10';
      extraImports = ['from datetime import datetime, timezone, timedelta'];
      evaluateBody = [
        '        if not context:',
        '            return False, 0.0, None',
        '        recent = context.get("recent_trades", [])',
        '        window_secs = ' + win,
        '        threshold   = ' + count,
        '        now = event.timestamp',
        '        count = sum(',
        '            1 for t in recent',
        '            if (',
        '                (t.get("trader_id") if isinstance(t, dict) else getattr(t, "trader_id", None)) == event.trader_id',
        '                and abs((now - (t.get("timestamp") if isinstance(t, dict) else getattr(t, "timestamp", now))).total_seconds()) <= window_secs',
        '            )',
        '        )',
        '        if count >= threshold:',
        '            return (',
        '                True,',
        '                self.default_score,',
        '                f"{count} events in {window_secs}s window (threshold: {threshold})",',
        '            )',
        '        return False, 0.0, None',
      ].join('\n');
      break;
    }
    case 'time_range': {
      const startH = detection.startHour      || '8';
      const endH   = detection.endHour        || '18';
      const vf     = detection.valueField     || 'order_value';
      const vthr   = detection.valueThreshold || '25000.0';
      const vLabel = vf.replace(/_/g, ' ');
      evaluateBody = [
        '        start_hour = context.get("start_hour", ' + startH + ') if context else ' + startH,
        '        end_hour   = context.get("end_hour",   ' + endH   + ') if context else ' + endH,
        '        threshold  = context.get("threshold",  ' + vthr   + ') if context else ' + vthr,
        '        ts = event.timestamp',
        '        is_weekend       = ts.weekday() >= 5',
        '        is_outside_hours = ts.hour < start_hour or ts.hour >= end_hour',
        '        if (is_weekend or is_outside_hours) and event.' + vf + ' >= threshold:',
        '            reason = "weekend" if is_weekend else f"outside {start_hour:02d}:00-{end_hour:02d}:00 UTC"',
        '            return (',
        '                True,',
        '                self.default_score,',
        '                f"' + vLabel + ' {event.' + vf + ':,.2f} triggered {reason} (threshold: {threshold:,.2f})",',
        '            )',
        '        return False, 0.0, None',
      ].join('\n');
      break;
    }
    case 'ratio': {
      const f      = detection.field    || 'quantity';
      const ratio  = detection.ratio    || '3.0';
      const refKey = detection.refField || 'avg_quantity';
      evaluateBody = [
        '        if not context:',
        '            return False, 0.0, None',
        '        ref_value = context.get("' + refKey + '", None)',
        '        ratio_threshold = ' + ratio,
        '        if ref_value and ref_value > 0:',
        '            actual_ratio = event.' + f + ' / ref_value',
        '            if actual_ratio >= ratio_threshold:',
        '                return (',
        '                    True,',
        '                    self.default_score,',
        '                    f"' + f + ' ratio {actual_ratio:.1f}x exceeds {ratio_threshold}x historical average",',
        '                )',
        '        return False, 0.0, None',
      ].join('\n');
      break;
    }
    case 'context_flag': {
      const flag = detection.flagKey || 'suspicious_flag';
      evaluateBody = [
        '        if not context:',
        '            return False, 0.0, None',
        '        if context.get("' + flag + '"):',
        '            return (',
        '                True,',
        '                self.default_score,',
        '                "Context flag \'' + flag + '\' detected for trader " + event.trader_id,',
        '            )',
        '        return False, 0.0, None',
      ].join('\n');
      break;
    }
  }

  const allImports = [...extraImports, ...baseImports].join('\n');
  return [
    allImports,
    '',
    '',
    'class ' + cls + '(BaseRiskRule):',
    '    code             = "' + code + '"',
    '    name             = "' + (identity.ruleName || 'Custom Rule') + '"',
    '    description      = "' + desc + '"',
    '    default_severity = AlertSeverity.' + sev,
    '    default_score    = ' + score,
    '',
    '    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:',
    evaluateBody,
    '',
  ].join('\n');
}


function generateInitSnippet(identity: Identity): string {
  const code  = toScreamingSnake(identity.ruleName) || 'CUSTOM_RULE';
  const cls   = toPascalCase(identity.ruleName) || 'CustomRule';
  const mod   = toFileName(identity.ruleName).replace('.py', '');
  return [
    '# In services/risk-engine/src/rules/__init__.py',
    'from .' + mod + ' import ' + cls,
    '',
    '# Add to ALL_RULES list:',
    'ALL_RULES = [',
    '    ...existing_rules...,',
    '    ' + cls + '(),   # <- new: ' + code,
    ']',
  ].join('\n');
}

// ─── Syntax Highlight (span-based, client-side only) ─────────────────────────

function highlight(rawCode: string): string {
  // Escape HTML
  let h = rawCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const placeholders: string[] = [];
  const ph = (content: string, cls: string) => {
    const idx = placeholders.length;
    placeholders.push(`<span class="${cls}">${content}</span>`);
    return `\x00${idx}\x00`;
  };

  // Order matters: strings & comments first to avoid re-wrapping
  h = h.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*')/g, m => ph(m, 'st'));
  h = h.replace(/(#[^\n]*)/g, m => ph(m, 'cm'));
  h = h.replace(/(@[A-Za-z_][A-Za-z0-9_.]*)/g, m => ph(m, 'dc'));
  h = h.replace(/\b([A-Z][A-Za-z0-9]+)\b/g, m => ph(m, 'cn'));
  h = h.replace(/\b([a-z_][a-z0-9_]*)\s*(?=\()/g, m => ph(m, 'fn'));
  h = h.replace(/\b(from|import|class|def|return|if|not|and|or|else|elif|True|False|None|in|for|is|await|async|raise|with|as|pass)\b/g, m => ph(m, 'kw'));
  h = h.replace(/\b(\d+\.?\d*)\b/g, m => ph(m, 'nm'));

  // Restore
  h = h.replace(/\x00(\d+)\x00/g, (_, i) => placeholders[+i]);
  return h;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const OPERATORS: Operator[]  = ['>=', '>', '<=', '<', '=='];

const TRADE_FIELDS = [
  { value: 'order_value', label: 'order_value  (qty × price)' },
  { value: 'quantity',    label: 'quantity' },
  { value: 'price',       label: 'price' },
  { value: 'side',        label: 'side  (BUY / SELL)' },
];

const TEMPLATES: { kind: TemplateKind; icon: string; name: string; desc: string }[] = [
  { kind: 'threshold',    icon: '⚖️',  name: 'Threshold',    desc: 'A numeric field exceeds or falls below a fixed value.' },
  { kind: 'count_window', icon: '🔢',  name: 'Count Window', desc: 'Count events for a trader in a rolling time window.' },
  { kind: 'time_range',   icon: '🕐',  name: 'Time Range',   desc: 'Trade happens outside market hours or on weekends.' },
  { kind: 'ratio',        icon: '📊',  name: 'Ratio',        desc: 'A field exceeds N× a reference value from context.' },
  { kind: 'context_flag', icon: '🚩',  name: 'Context Flag', desc: 'A boolean flag is set in the evaluation context dict.' },
];

function Stepper({ step }: { step: number }) {
  const steps = ['Rule Identity', 'Detection Logic', 'Generated Code'];
  return (
    <div className="wizard-stepper">
      {steps.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : '';
        return (
          <div key={i} className="wizard-step-item">
            <div className={`wizard-step-circle ${state}`}>{i < step ? '✓' : i + 1}</div>
            <span className={`wizard-step-label ${state}`}>{label}</span>
            {i < steps.length - 1 && (
              <div className={`wizard-step-connector ${i < step ? 'done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function StepIdentity({ identity, onChange }: {
  identity: Identity;
  onChange: (p: Partial<Identity>) => void;
}) {
  return (
    <div className="wizard-step-content">
      <FormField label="Rule Name *">
        <input
          id="rule-name"
          type="text"
          className="input"
          placeholder="e.g. Suspicious After-Hours Trade"
          value={identity.ruleName}
          onChange={e => onChange({ ruleName: e.target.value })}
          autoFocus
        />
        {identity.ruleName && (
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Code:{' '}
              <code style={{ color: 'var(--accent)', background: 'var(--accent-dim)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                {toScreamingSnake(identity.ruleName)}
              </code>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Class:{' '}
              <code style={{ color: 'var(--purple)', background: 'var(--purple-dim)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                {toPascalCase(identity.ruleName)}
              </code>
            </span>
          </div>
        )}
      </FormField>

      <FormField label="Description">
        <textarea
          id="rule-description"
          className="input"
          rows={3}
          placeholder="Describe what this rule detects and why it is suspicious..."
          value={identity.description}
          onChange={e => onChange({ description: e.target.value })}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </FormField>

      <FormField label="Severity">
        <div className="severity-pill-group">
          {SEVERITIES.map(s => (
            <button
              key={s}
              id={`severity-${s.toLowerCase()}`}
              type="button"
              className={`severity-pill ${s.toLowerCase()} ${identity.severity === s ? 'selected' : ''}`}
              onClick={() => onChange({ severity: s, score: SEVERITY_SCORE_MAP[s] })}
            >
              {s}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label={`Default Risk Score — ${identity.score}`}>
        <input
          id="risk-score-slider"
          type="range"
          min={0} max={100} step={1}
          value={identity.score}
          onChange={e => onChange({ score: Number(e.target.value) })}
          className="score-slider"
          style={{ marginTop: '0.25rem' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          <span>0 — Low</span><span>50 — Medium</span><span>100 — Critical</span>
        </div>
      </FormField>
    </div>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function StepDetection({ detection, onChange }: {
  detection: Detection;
  onChange: (p: Partial<Detection>) => void;
}) {
  return (
    <div className="wizard-step-content">
      <FormField label="Detection Template">
        <div className="template-grid">
          {TEMPLATES.map(t => (
            <label key={t.kind} className="template-card">
              <input
                type="radio"
                name="template"
                value={t.kind}
                checked={detection.template === t.kind}
                onChange={() => onChange({ template: t.kind })}
              />
              <div className="template-card-inner">
                <div className="template-card-icon">{t.icon}</div>
                <div className="template-card-name">{t.name}</div>
                <div className="template-card-desc">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </FormField>

      {detection.template === 'threshold' && (
        <div className="wizard-step-content" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr', gap: '0.875rem', alignItems: 'end' }}>
          <FormField label="Event Field">
            <select id="field-select" className="field-select" value={detection.field} onChange={e => onChange({ field: e.target.value })}>
              {TRADE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </FormField>
          <FormField label="Operator">
            <select id="operator-select" className="field-select" value={detection.operator} onChange={e => onChange({ operator: e.target.value as Operator })}>
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </FormField>
          <FormField label="Default Threshold">
            <input id="threshold-value" type="number" className="input" value={detection.threshold} onChange={e => onChange({ threshold: e.target.value })} placeholder="100000" />
          </FormField>
        </div>
      )}

      {detection.template === 'count_window' && (
        <div className="wizard-step-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <FormField label="Time Window (seconds)">
            <input id="window-secs" type="number" className="input" value={detection.windowSecs} onChange={e => onChange({ windowSecs: e.target.value })} placeholder="300" />
          </FormField>
          <FormField label="Minimum Event Count">
            <input id="count-threshold" type="number" className="input" value={detection.countThreshold} onChange={e => onChange({ countThreshold: e.target.value })} placeholder="10" />
          </FormField>
        </div>
      )}

      {detection.template === 'time_range' && (
        <div className="wizard-step-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
          <FormField label="Market Start Hour (UTC)">
            <input id="start-hour" type="number" min={0} max={23} className="input" value={detection.startHour} onChange={e => onChange({ startHour: e.target.value })} placeholder="8" />
          </FormField>
          <FormField label="Market End Hour (UTC)">
            <input id="end-hour" type="number" min={0} max={23} className="input" value={detection.endHour} onChange={e => onChange({ endHour: e.target.value })} placeholder="18" />
          </FormField>
          <FormField label="Value Field">
            <select id="value-field-select" className="field-select" value={detection.valueField} onChange={e => onChange({ valueField: e.target.value })}>
              {TRADE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </FormField>
          <FormField label="Value Threshold">
            <input id="value-threshold" type="number" className="input" value={detection.valueThreshold} onChange={e => onChange({ valueThreshold: e.target.value })} placeholder="25000" />
          </FormField>
        </div>
      )}

      {detection.template === 'ratio' && (
        <div className="wizard-step-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
          <FormField label="Event Field">
            <select id="ratio-field-select" className="field-select" value={detection.field} onChange={e => onChange({ field: e.target.value })}>
              {TRADE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </FormField>
          <FormField label="Context Reference Key">
            <input id="ref-field" type="text" className="input" value={detection.refField} onChange={e => onChange({ refField: e.target.value })} placeholder="avg_quantity" />
          </FormField>
          <FormField label="Ratio Multiplier (N×)">
            <input id="ratio-multiplier" type="number" step="0.5" className="input" value={detection.ratio} onChange={e => onChange({ ratio: e.target.value })} placeholder="3.0" />
          </FormField>
        </div>
      )}

      {detection.template === 'context_flag' && (
        <div className="wizard-step-content">
          <FormField label="Context Dictionary Key">
            <input
              id="flag-key"
              type="text"
              className="input"
              value={detection.flagKey}
              onChange={e => onChange({ flagKey: e.target.value })}
              placeholder="e.g. wash_trade_detected"
              style={{ maxWidth: 360 }}
            />
          </FormField>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            The rule triggers when{' '}
            <code style={{ color: 'var(--accent)' }}>
              context.get(&quot;{detection.flagKey || 'flag_key'}&quot;)
            </code>{' '}
            is truthy.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function StepGenerated({ identity, detection }: { identity: Identity; detection: Detection }) {
  const [copied, setCopied]               = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const code    = generateCode(identity, detection);
  const snippet = generateInitSnippet(identity);
  const fname   = toFileName(identity.ruleName) || 'custom_rule.py';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const handleCopySnippet = useCallback(() => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    });
  }, [snippet]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, fname]);

  const templateLabel = TEMPLATES.find(t => t.kind === detection.template)?.name ?? detection.template;

  return (
    <div className="wizard-step-content">
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.3)' }}>
          📄 {fname}
        </span>
        <span className={`badge badge-${identity.severity.toLowerCase()}`}>{identity.severity}</span>
        <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          score: {identity.score}
        </span>
        <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          template: {templateLabel}
        </span>
      </div>

      {/* Main code block */}
      <div className="code-block-wrap">
        <div className="code-block-header">
          <span className="code-block-lang">🐍 Python &nbsp;·&nbsp; {fname}</span>
          <div className="code-block-actions">
            <button id="btn-copy-code" className={`code-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
            <button id="btn-download-code" className="code-btn" onClick={handleDownload}>
              ⬇ Download
            </button>
          </div>
        </div>
        <pre className="code-block" dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </div>

      {/* Registration snippet */}
      <div className="snippet-section">
        <div className="snippet-header">
          <span>📦 __init__.py registration snippet</span>
          <button
            id="btn-copy-snippet"
            className={`code-btn ${copiedSnippet ? 'copied' : ''}`}
            onClick={handleCopySnippet}
            style={{ fontSize: '0.68rem' }}
          >
            {copiedSnippet ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
        <pre className="snippet-block">{snippet}</pre>
      </div>

      {/* Info box */}
      <div style={{
        marginTop: '1.25rem',
        padding: '0.875rem 1.25rem',
        background: 'var(--accent-dim)',
        border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem',
        color: 'var(--accent)',
        lineHeight: 1.6,
      }}>
        ℹ️ <strong>Next steps:</strong> Save the file to{' '}
        <code>services/risk-engine/src/rules/{fname}</code>, then add the import and class instance
        to <code>__init__.py</code> using the snippet above. The risk engine will automatically pick
        it up on restart.
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CodeGenPage() {
  const [step, setStep] = useState(0);

  const [identity, setIdentity] = useState<Identity>({
    ruleName: '',
    description: '',
    severity: 'HIGH',
    score: SEVERITY_SCORE_MAP['HIGH'],
  });

  const [detection, setDetection] = useState<Detection>({
    template: 'threshold',
    field: 'order_value',
    operator: '>=',
    threshold: '100000.0',
    windowSecs: '300',
    countThreshold: '10',
    startHour: '8',
    endHour: '18',
    valueField: 'order_value',
    valueThreshold: '25000.0',
    refField: 'avg_quantity',
    ratio: '3.0',
    flagKey: 'suspicious_flag',
  });

  const canProceedStep0 = identity.ruleName.trim().length > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Rule Template Wizard</h1>
            <p className="page-subtitle">Generate production-ready Python risk rule code from structured inputs</p>
          </div>
          <div style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Client-side &mdash; no server required</span>
          </div>
        </div>
      </div>

      {/* Wizard card */}
      <div className="card fade-in" style={{ padding: '2rem' }}>
        <Stepper step={step} />

        {step === 0 && (
          <StepIdentity
            identity={identity}
            onChange={p => setIdentity(prev => ({ ...prev, ...p }))}
          />
        )}
        {step === 1 && (
          <StepDetection
            detection={detection}
            onChange={p => setDetection(prev => ({ ...prev, ...p }))}
          />
        )}
        {step === 2 && (
          <StepGenerated identity={identity} detection={detection} />
        )}

        {/* Navigation */}
        <div className="wizard-nav">
          <div>
            {step > 0 && (
              <button id="btn-wizard-back" className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
                ← Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {step === 0 && !canProceedStep0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter a rule name to continue</span>
            )}
            {step < 2 && (
              <button
                id="btn-wizard-next"
                className="btn btn-primary"
                disabled={step === 0 && !canProceedStep0}
                onClick={() => setStep(s => s + 1)}
              >
                {step === 1 ? '⚡ Generate Code →' : 'Next →'}
              </button>
            )}
            {step === 2 && (
              <button
                id="btn-wizard-restart"
                className="btn btn-ghost"
                onClick={() => {
                  setStep(0);
                  setIdentity({ ruleName: '', description: '', severity: 'HIGH', score: 75 });
                }}
              >
                ↺ Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      {/* How it works — shown only on step 0 */}
      {step === 0 && (
        <div className="card fade-in" style={{ marginTop: '1.25rem', padding: '1.25rem 1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>✨ How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { icon: '📝', n: '1', title: 'Define Identity',   desc: 'Name your rule, describe what it detects, pick a severity level and risk score.' },
              { icon: '🧩', n: '2', title: 'Choose Template',   desc: 'Select a detection pattern and fill in the parameters — no Python required.' },
              { icon: '⚡', n: '3', title: 'Generate & Export', desc: 'Copy or download the ready-to-use Python class plus the __init__.py snippet.' },
              { icon: '🚀', n: '4', title: 'Deploy',            desc: 'Drop the file into the rules directory and restart the risk engine — done.' },
            ].map(item => (
              <div key={item.n} style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{item.icon}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Step {item.n}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
