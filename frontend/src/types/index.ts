export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'CLOSED';

export interface Alert {
  alert_id: string;
  event_id: string;
  trader_id: string;
  rule_code: string;
  title: string;
  description?: string;
  rule_score: number;
  anomaly_score: number;
  final_risk_score: number;
  severity: AlertSeverity;
  status: AlertStatus;
  assigned_to?: string;
  detected_at: string;
}

export interface DashboardSummary {
  events_processed_today: number;
  total_open_alerts: number;
  critical_alerts: number;
  high_risk_traders: number;
  confirmed_incidents: number;
  average_processing_time_ms: number;
}

export interface RiskRule {
  code: string;
  name: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}
