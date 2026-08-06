from unittest.mock import patch
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity, EventType, OrderSide, OrderType
from datetime import datetime, timezone
from services.risk_engine.src.evaluator import RiskEvaluator, calculate_severity

def test_calculate_severity():
    assert calculate_severity(85.0) == AlertSeverity.CRITICAL
    assert calculate_severity(65.0) == AlertSeverity.HIGH
    assert calculate_severity(45.0) == AlertSeverity.MEDIUM
    assert calculate_severity(15.0) == AlertSeverity.LOW

def test_evaluator_triggers_large_order(sample_trade_event):
    evaluator = RiskEvaluator()
    sample_trade_event.quantity = 1000.0
    sample_trade_event.price = 150.0  # order_value = 150,000 >= 100,000

    alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=10.0)
    assert alert is not None
    assert alert.rule_code == "LARGE_ORDER"
    assert alert.rule_score == 75.0
    assert alert.anomaly_score == 10.0
    # final_risk_score = 75.0 * 0.7 + 10.0 * 0.3 = 52.5 + 3.0 = 55.5
    assert alert.final_risk_score == 55.5
    assert alert.severity == AlertSeverity.MEDIUM

def test_evaluator_no_trigger(sample_trade_event):
    evaluator = RiskEvaluator()
    sample_trade_event.quantity = 10.0
    sample_trade_event.price = 50.0

    alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=10.0)
    assert alert is None

def test_evaluator_ml_anomaly_only(sample_trade_event):
    evaluator = RiskEvaluator()
    sample_trade_event.quantity = 10.0
    sample_trade_event.price = 50.0

    alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=80.0)
    assert alert is not None
    assert alert.rule_code == "ML_ANOMALY"
    assert alert.rule_score == 0.0
    assert alert.anomaly_score == 80.0
    # final_risk_score = 0 * 0.7 + 80 * 0.3 = 24.0
    assert alert.final_risk_score == 24.0
    assert alert.severity == AlertSeverity.LOW
