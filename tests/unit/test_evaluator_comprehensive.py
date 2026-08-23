"""
Comprehensive unit tests for the RiskEvaluator engine and calculate_severity utility.
Tests cover: severity thresholds, rule selection, ML-only anomaly fallback,
             composite score formula, alert field integrity, and edge cases.
"""
import pytest
from datetime import datetime, timezone, timedelta
from shared.schemas import AlertSeverity, EventType, OrderSide
from services.risk_engine.src.evaluator import RiskEvaluator, calculate_severity


# ─────────────────────────────────────────────────────────────
# calculate_severity — boundary tests
# ─────────────────────────────────────────────────────────────

class TestCalculateSeverity:
    def test_critical_at_80(self):
        assert calculate_severity(80.0) == AlertSeverity.CRITICAL

    def test_critical_above_80(self):
        assert calculate_severity(95.0) == AlertSeverity.CRITICAL

    def test_high_at_60(self):
        assert calculate_severity(60.0) == AlertSeverity.HIGH

    def test_high_just_below_critical(self):
        assert calculate_severity(79.9) == AlertSeverity.HIGH

    def test_medium_at_30(self):
        assert calculate_severity(30.0) == AlertSeverity.MEDIUM

    def test_medium_just_below_high(self):
        assert calculate_severity(59.9) == AlertSeverity.MEDIUM

    def test_low_below_30(self):
        assert calculate_severity(29.9) == AlertSeverity.LOW

    def test_low_at_zero(self):
        assert calculate_severity(0.0) == AlertSeverity.LOW

    def test_low_small_value(self):
        assert calculate_severity(15.0) == AlertSeverity.LOW


# ─────────────────────────────────────────────────────────────
# RiskEvaluator — core evaluation logic
# ─────────────────────────────────────────────────────────────

class TestRiskEvaluatorLargeOrder:
    def test_large_order_triggers_alert(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0  # $150,000

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=10.0)
        assert alert is not None
        assert alert.rule_code == "LARGE_ORDER"
        assert alert.rule_score == 75.0
        assert alert.anomaly_score == 10.0
        # 75.0 * 0.7 + 10.0 * 0.3 = 52.5 + 3.0 = 55.5
        assert alert.final_risk_score == 55.5
        assert alert.severity == AlertSeverity.MEDIUM

    def test_alert_carries_correct_trader_and_event_ids(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=0.0)
        assert alert.trader_id == sample_trade_event.trader_id
        assert alert.event_id == sample_trade_event.event_id

    def test_alert_id_format(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0

        alert = evaluator.evaluate_event(sample_trade_event)
        assert alert.alert_id.startswith("ALT-")
        assert len(alert.alert_id) == 10  # "ALT-" + 6 hex chars

    def test_detected_at_is_recent(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0

        before = datetime.now(timezone.utc)
        alert = evaluator.evaluate_event(sample_trade_event)
        after = datetime.now(timezone.utc)
        assert before <= alert.detected_at <= after


class TestRiskEvaluatorNoTrigger:
    def test_returns_none_when_no_rule_and_low_anomaly(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=10.0)
        assert alert is None

    def test_returns_none_at_anomaly_just_below_60(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=59.9)
        assert alert is None

    def test_returns_none_with_zero_anomaly(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 1.0
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=0.0)
        assert alert is None


class TestRiskEvaluatorMLAnomalyOnly:
    def test_ml_anomaly_only_above_60(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=80.0)
        assert alert is not None
        assert alert.rule_code == "ML_ANOMALY"
        assert alert.title == "Machine Learning Anomaly Detected"
        assert alert.rule_score == 0.0
        assert alert.anomaly_score == 80.0
        # 0 * 0.7 + 80 * 0.3 = 24.0
        assert alert.final_risk_score == 24.0
        assert alert.severity == AlertSeverity.LOW

    def test_ml_anomaly_at_exactly_60(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=60.0)
        assert alert is not None
        assert alert.rule_code == "ML_ANOMALY"
        # 0 * 0.7 + 60 * 0.3 = 18.0
        assert alert.final_risk_score == 18.0

    def test_ml_anomaly_description_is_none(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=70.0)
        assert alert.description is None


class TestRiskEvaluatorCompositeScoring:
    def test_rule_plus_anomaly_score_combined(self, sample_trade_event):
        """Verify: final = rule_score * 0.70 + anomaly_score * 0.30"""
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0  # triggers LARGE_ORDER (score=75)

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=50.0)
        expected = round(75.0 * 0.70 + 50.0 * 0.30, 2)
        assert alert.final_risk_score == expected  # 67.5

    def test_high_anomaly_with_rule_elevates_severity(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 150.0  # LARGE_ORDER rule_score=75
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=100.0)
        # 75 * 0.7 + 100 * 0.3 = 52.5 + 30 = 82.5
        assert alert.final_risk_score == 82.5
        assert alert.severity == AlertSeverity.CRITICAL


class TestRiskEvaluatorNewDeviceRule:
    def test_new_device_high_value_produces_critical(self, sample_trade_event):
        evaluator = RiskEvaluator()
        sample_trade_event.is_new_device = True
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 100.0  # $100,000 (triggers both NEW_DEVICE and LARGE_ORDER)

        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=0.0)
        assert alert is not None
        # NEW_DEVICE_HIGH_VALUE scores 90 vs LARGE_ORDER 75 — highest wins
        assert alert.rule_code == "NEW_DEVICE_HIGH_VALUE"
        assert alert.rule_score == 90.0
        # 90 * 0.7 + 0 * 0.3 = 63.0 → HIGH
        assert alert.severity == AlertSeverity.HIGH


class TestRiskEvaluatorWashTrading:
    def test_wash_trading_with_context(self, sample_trade_event):
        evaluator = RiskEvaluator()
        context = {"wash_trade_detected": True}
        alert = evaluator.evaluate_event(sample_trade_event, anomaly_score=20.0, context=context)
        assert alert is not None
        assert alert.rule_code == "WASH_TRADING"
        assert alert.rule_score == 85.0
        expected = round(85.0 * 0.70 + 20.0 * 0.30, 2)
        assert alert.final_risk_score == expected
