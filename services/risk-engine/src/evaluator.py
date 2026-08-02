import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
from shared.event_contracts import TradeEvent, AlertEvent
from shared.schemas import AlertSeverity
from services.risk-engine.src.rules import ALL_RULES

def calculate_severity(risk_score: float) -> AlertSeverity:
    if risk_score >= 80.0:
        return AlertSeverity.CRITICAL
    elif risk_score >= 60.0:
        return AlertSeverity.HIGH
    elif risk_score >= 30.0:
        return AlertSeverity.MEDIUM
    else:
        return AlertSeverity.LOW

class RiskEvaluator:
    def __init__(self):
        self.rules = ALL_RULES

    def evaluate_event(self, event: TradeEvent, anomaly_score: float = 0.0, context: Optional[dict] = None) -> Optional[AlertEvent]:
        highest_rule_score = 0.0
        triggered_rule = None
        description = None

        for rule in self.rules:
            triggered, score, desc = rule.evaluate(event, context)
            if triggered and score > highest_rule_score:
                highest_rule_score = score
                triggered_rule = rule
                description = desc

        if not triggered_rule and anomaly_score < 60.0:
            return None

        rule_score = highest_rule_score if triggered_rule else 0.0
        final_risk_score = round(rule_score * 0.70 + anomaly_score * 0.30, 2)
        severity = calculate_severity(final_risk_score)

        rule_code = triggered_rule.code if triggered_rule else "ML_ANOMALY"
        title = triggered_rule.name if triggered_rule else "Machine Learning Anomaly Detected"

        return AlertEvent(
            alert_id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
            event_id=event.event_id,
            trader_id=event.trader_id,
            rule_code=rule_code,
            title=title,
            description=description,
            rule_score=rule_score,
            anomaly_score=anomaly_score,
            final_risk_score=final_risk_score,
            severity=severity,
            detected_at=datetime.now(timezone.utc)
        )

evaluator = RiskEvaluator()
