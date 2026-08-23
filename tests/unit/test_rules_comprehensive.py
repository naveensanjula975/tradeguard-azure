"""
Comprehensive unit tests for all Risk Engine rules.
Covers: LargeOrder, NewDeviceHighValue, RapidCancellation, ExcessiveTradingFrequency,
        UnusualVolume, WashTrading, SpoofingLayering, OffHoursTrading, PriceSpike
"""
import pytest
from datetime import datetime, timezone, timedelta
from shared.schemas import EventType, OrderSide, OrderType
from services.risk_engine.src.rules import (
    LargeOrderRule,
    NewDeviceHighValueRule,
    RapidCancellationRule,
    ExcessiveTradingFrequencyRule,
    UnusualVolumeRule,
    WashTradingRule,
    SpoofingLayeringRule,
    OffHoursTradingRule,
    PriceSpikeRule,
)


# ─────────────────────────────────────────────────────────────
# LargeOrderRule
# ─────────────────────────────────────────────────────────────

class TestLargeOrderRule:
    def test_triggered_at_exact_threshold(self, sample_trade_event):
        rule = LargeOrderRule()
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 100.0  # $100,000 == threshold
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert score == 75.0
        assert "$100,000.00" in desc

    def test_triggered_above_threshold(self, sample_trade_event):
        rule = LargeOrderRule()
        sample_trade_event.quantity = 500.0
        sample_trade_event.price = 300.0  # $150,000 > $100,000
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert score == 75.0
        assert desc is not None

    def test_not_triggered_below_threshold(self, sample_trade_event):
        rule = LargeOrderRule()
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 50.0  # $500 < $100,000
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is False
        assert score == 0.0
        assert desc is None

    def test_not_triggered_just_below_threshold(self, sample_trade_event):
        rule = LargeOrderRule()
        sample_trade_event.quantity = 999.0
        sample_trade_event.price = 100.0  # $99,900 < $100,000
        triggered, score, _ = rule.evaluate(sample_trade_event)
        assert triggered is False

    def test_rule_code_and_name(self):
        rule = LargeOrderRule()
        assert rule.code == "LARGE_ORDER"
        assert rule.name == "Large Order Detection"
        assert rule.threshold == 100_000.0

    def test_description_contains_threshold(self, sample_trade_event):
        rule = LargeOrderRule()
        sample_trade_event.quantity = 2000.0
        sample_trade_event.price = 200.0  # $400,000
        _, _, desc = rule.evaluate(sample_trade_event)
        assert "100,000.00" in desc  # threshold shown in message


# ─────────────────────────────────────────────────────────────
# NewDeviceHighValueRule
# ─────────────────────────────────────────────────────────────

class TestNewDeviceHighValueRule:
    def test_triggered_new_device_and_high_value(self, sample_trade_event):
        rule = NewDeviceHighValueRule()
        sample_trade_event.is_new_device = True
        sample_trade_event.quantity = 500.0
        sample_trade_event.price = 120.0  # $60,000 >= $50,000
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert score == 90.0
        assert sample_trade_event.device_id in desc

    def test_not_triggered_known_device(self, sample_trade_event):
        rule = NewDeviceHighValueRule()
        sample_trade_event.is_new_device = False
        sample_trade_event.quantity = 500.0
        sample_trade_event.price = 120.0
        triggered, score, _ = rule.evaluate(sample_trade_event)
        assert triggered is False
        assert score == 0.0

    def test_not_triggered_new_device_low_value(self, sample_trade_event):
        rule = NewDeviceHighValueRule()
        sample_trade_event.is_new_device = True
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 100.0  # $1,000 < $50,000
        triggered, score, _ = rule.evaluate(sample_trade_event)
        assert triggered is False

    def test_triggered_at_exact_threshold(self, sample_trade_event):
        rule = NewDeviceHighValueRule()
        sample_trade_event.is_new_device = True
        sample_trade_event.quantity = 1000.0
        sample_trade_event.price = 50.0  # exactly $50,000
        triggered, score, _ = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert score == 90.0

    def test_rule_code_and_threshold(self):
        rule = NewDeviceHighValueRule()
        assert rule.code == "NEW_DEVICE_HIGH_VALUE"
        assert rule.threshold == 50_000.0


# ─────────────────────────────────────────────────────────────
# RapidCancellationRule
# ─────────────────────────────────────────────────────────────

class TestRapidCancellationRule:
    def test_triggered_at_threshold(self, sample_trade_event):
        rule = RapidCancellationRule()
        context = {"cancellations_last_5m": 10}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 75.0
        assert "10" in desc

    def test_triggered_above_threshold(self, sample_trade_event):
        rule = RapidCancellationRule()
        context = {"cancellations_last_5m": 25}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert "25" in desc

    def test_not_triggered_below_threshold(self, sample_trade_event):
        rule = RapidCancellationRule()
        context = {"cancellations_last_5m": 9}
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False
        assert score == 0.0

    def test_no_context_returns_false(self, sample_trade_event):
        rule = RapidCancellationRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False
        assert score == 0.0

    def test_empty_context_returns_false(self, sample_trade_event):
        rule = RapidCancellationRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context={})
        assert triggered is False

    def test_rule_code(self):
        assert RapidCancellationRule.code == "RAPID_CANCELLATION"


# ─────────────────────────────────────────────────────────────
# ExcessiveTradingFrequencyRule
# ─────────────────────────────────────────────────────────────

class TestExcessiveTradingFrequencyRule:
    def test_triggered_above_30(self, sample_trade_event):
        rule = ExcessiveTradingFrequencyRule()
        context = {"orders_last_1m": 31}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 50.0
        assert "31" in desc

    def test_not_triggered_at_30(self, sample_trade_event):
        rule = ExcessiveTradingFrequencyRule()
        context = {"orders_last_1m": 30}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False  # strictly > 30

    def test_not_triggered_below_30(self, sample_trade_event):
        rule = ExcessiveTradingFrequencyRule()
        context = {"orders_last_1m": 5}
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False
        assert score == 0.0

    def test_no_context_returns_false(self, sample_trade_event):
        rule = ExcessiveTradingFrequencyRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False

    def test_rule_code(self):
        assert ExcessiveTradingFrequencyRule.code == "EXCESSIVE_FREQUENCY"


# ─────────────────────────────────────────────────────────────
# UnusualVolumeRule
# ─────────────────────────────────────────────────────────────

class TestUnusualVolumeRule:
    def test_triggered_volume_exceeds_3x(self, sample_trade_event):
        rule = UnusualVolumeRule()
        sample_trade_event.quantity = 310.0
        context = {"historical_avg_volume": 100.0}  # 310 > 300
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 50.0
        assert "310" in desc

    def test_not_triggered_at_3x(self, sample_trade_event):
        rule = UnusualVolumeRule()
        sample_trade_event.quantity = 300.0
        context = {"historical_avg_volume": 100.0}  # 300 == 3x, not >
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False  # strictly > 3 * avg

    def test_not_triggered_below_3x(self, sample_trade_event):
        rule = UnusualVolumeRule()
        sample_trade_event.quantity = 200.0
        context = {"historical_avg_volume": 100.0}
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False
        assert score == 0.0

    def test_no_historical_avg_returns_false(self, sample_trade_event):
        rule = UnusualVolumeRule()
        context = {"historical_avg_volume": 0.0}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False

    def test_no_context_returns_false(self, sample_trade_event):
        rule = UnusualVolumeRule()
        triggered, _, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False

    def test_rule_code(self):
        assert UnusualVolumeRule.code == "UNUSUAL_VOLUME"


# ─────────────────────────────────────────────────────────────
# WashTradingRule
# ─────────────────────────────────────────────────────────────

class TestWashTradingRule:
    def test_triggered_via_context_flag(self, sample_trade_event):
        rule = WashTradingRule()
        triggered, score, desc = rule.evaluate(
            sample_trade_event, context={"wash_trade_detected": True}
        )
        assert triggered is True
        assert score == 85.0
        assert "context flag" in desc

    def test_triggered_by_recent_trade_matching(self, sample_trade_event):
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": sample_trade_event.trader_id,
            "instrument": sample_trade_event.instrument,
            "side": OrderSide.SELL,  # opposite of BUY
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=15),
        }
        triggered, score, desc = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is True
        assert score == 85.0
        assert "Wash trading detected" in desc

    def test_not_triggered_time_window_exceeded(self, sample_trade_event):
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": sample_trade_event.trader_id,
            "instrument": sample_trade_event.instrument,
            "side": OrderSide.SELL,
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=60),  # > 30s
        }
        triggered, _, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is False

    def test_not_triggered_same_side(self, sample_trade_event):
        """Same side (BUY/BUY) should not trigger wash trading."""
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": sample_trade_event.trader_id,
            "instrument": sample_trade_event.instrument,
            "side": OrderSide.BUY,  # same side — not offsetting
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=5),
        }
        triggered, _, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is False

    def test_not_triggered_different_instrument(self, sample_trade_event):
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": sample_trade_event.trader_id,
            "instrument": "GOOG",  # different instrument
            "side": OrderSide.SELL,
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=5),
        }
        triggered, _, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is False

    def test_not_triggered_different_trader(self, sample_trade_event):
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": "TRD-9999",  # different trader
            "instrument": sample_trade_event.instrument,
            "side": OrderSide.SELL,
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=5),
        }
        triggered, _, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is False

    def test_no_context_returns_false(self, sample_trade_event):
        rule = WashTradingRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False
        assert score == 0.0

    def test_empty_recent_trades_returns_false(self, sample_trade_event):
        rule = WashTradingRule()
        triggered, _, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": []}
        )
        assert triggered is False

    def test_triggered_at_exactly_30_seconds(self, sample_trade_event):
        """Trade at exactly 30 seconds should still trigger (time_diff <= 30.0)."""
        rule = WashTradingRule()
        recent_trade = {
            "trader_id": sample_trade_event.trader_id,
            "instrument": sample_trade_event.instrument,
            "side": OrderSide.SELL,
            "timestamp": sample_trade_event.timestamp - timedelta(seconds=30),
        }
        triggered, score, _ = rule.evaluate(
            sample_trade_event, context={"recent_trades": [recent_trade]}
        )
        assert triggered is True
        assert score == 85.0

    def test_rule_code(self):
        assert WashTradingRule.code == "WASH_TRADING"


# ─────────────────────────────────────────────────────────────
# SpoofingLayeringRule
# ─────────────────────────────────────────────────────────────

class TestSpoofingLayeringRule:
    def test_triggered_via_context_flag(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        context = {"spoofing_pattern_detected": True}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 75.0
        assert "surveillance" in desc

    def test_triggered_by_cancellations(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        sample_trade_event.event_type = EventType.ORDER_CANCELLED
        context = {"cancellations_within_1m": 5}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 75.0
        assert "5" in desc

    def test_not_triggered_cancellations_below_5(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        sample_trade_event.event_type = EventType.ORDER_CANCELLED
        context = {"cancellations_within_1m": 4}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False

    def test_triggered_high_cancellation_ratio(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        context = {
            "cancellation_ratio": 0.85,
            "total_orders_1m": 10
        }
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 75.0
        assert "85%" in desc

    def test_not_triggered_ratio_below_0_8(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        context = {"cancellation_ratio": 0.79, "total_orders_1m": 10}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False

    def test_not_triggered_ratio_high_but_low_orders(self, sample_trade_event):
        """High ratio needs at least 5 total orders to trigger."""
        rule = SpoofingLayeringRule()
        context = {"cancellation_ratio": 0.9, "total_orders_1m": 4}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False

    def test_no_context_returns_false(self, sample_trade_event):
        rule = SpoofingLayeringRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False
        assert score == 0.0

    def test_rule_code(self):
        assert SpoofingLayeringRule.code == "SPOOFING_LAYERING"


# ─────────────────────────────────────────────────────────────
# OffHoursTradingRule
# ─────────────────────────────────────────────────────────────

class TestOffHoursTradingRule:
    # Sunday 02:00 UTC — weekend + above threshold
    WEEKEND_TIMESTAMP = datetime(2026, 8, 2, 2, 0, 0, tzinfo=timezone.utc)
    # Monday 10:00 UTC — weekday within market hours
    WORKING_TIMESTAMP = datetime(2026, 8, 3, 10, 0, 0, tzinfo=timezone.utc)
    # Saturday 10:00 UTC — weekend but within hours (still triggers by weekend flag)
    SAT_WORKING_HOURS = datetime(2026, 8, 1, 10, 0, 0, tzinfo=timezone.utc)

    def test_triggered_weekend(self, sample_trade_event):
        rule = OffHoursTradingRule()
        sample_trade_event.timestamp = self.WEEKEND_TIMESTAMP
        sample_trade_event.quantity = 200.0
        sample_trade_event.price = 200.0  # $40,000 >= $25,000
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert score == 50.0
        assert "weekend" in desc

    def test_triggered_outside_hours(self, sample_trade_event):
        rule = OffHoursTradingRule()
        # Monday at 05:00 UTC (before 08:00)
        sample_trade_event.timestamp = datetime(2026, 8, 3, 5, 0, 0, tzinfo=timezone.utc)
        sample_trade_event.quantity = 200.0
        sample_trade_event.price = 200.0  # $40,000 >= $25,000
        triggered, score, desc = rule.evaluate(sample_trade_event)
        assert triggered is True
        assert "outside" in desc

    def test_triggered_weekend_with_custom_threshold(self, sample_trade_event):
        rule = OffHoursTradingRule()
        sample_trade_event.timestamp = self.SAT_WORKING_HOURS
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 100.0  # $1,000
        context = {"off_hours_threshold": 500.0}  # lower threshold
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True  # $1,000 >= $500 threshold

    def test_not_triggered_weekend_low_value(self, sample_trade_event):
        rule = OffHoursTradingRule()
        sample_trade_event.timestamp = self.WEEKEND_TIMESTAMP
        sample_trade_event.quantity = 5.0
        sample_trade_event.price = 10.0  # $50 < $25,000
        triggered, _, _ = rule.evaluate(sample_trade_event)
        assert triggered is False

    def test_not_triggered_working_hours_weekday(self, sample_trade_event):
        rule = OffHoursTradingRule()
        sample_trade_event.timestamp = self.WORKING_TIMESTAMP
        sample_trade_event.quantity = 10.0
        sample_trade_event.price = 100.0  # $1,000 < threshold
        triggered, _, _ = rule.evaluate(sample_trade_event)
        assert triggered is False

    def test_not_triggered_high_value_working_hours(self, sample_trade_event):
        """High value within working hours on a weekday — should not trigger."""
        rule = OffHoursTradingRule()
        sample_trade_event.timestamp = self.WORKING_TIMESTAMP
        sample_trade_event.quantity = 2000.0
        sample_trade_event.price = 200.0  # $400,000 but within hours
        triggered, _, _ = rule.evaluate(sample_trade_event)
        assert triggered is False

    def test_custom_market_hours(self, sample_trade_event):
        rule = OffHoursTradingRule()
        # Monday 07:00 UTC — within default 08-18 window but outside custom 09-17 window
        sample_trade_event.timestamp = datetime(2026, 8, 3, 7, 0, 0, tzinfo=timezone.utc)
        sample_trade_event.quantity = 200.0
        sample_trade_event.price = 200.0
        context = {"market_start_hour_utc": 9, "market_end_hour_utc": 17}
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 50.0

    def test_rule_code(self):
        assert OffHoursTradingRule.code == "OFF_HOURS_TRADING"


# ─────────────────────────────────────────────────────────────
# PriceSpikeRule
# ─────────────────────────────────────────────────────────────

class TestPriceSpikeRule:
    def test_triggered_above_default_threshold(self, sample_trade_event):
        rule = PriceSpikeRule()
        sample_trade_event.price = 250.0
        context = {"benchmark_price": 200.0}  # 25% deviation >= 15%
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert score == 70.0
        assert "25.00%" in desc

    def test_triggered_downward_spike(self, sample_trade_event):
        """Negative deviation should also trigger if abs(deviation) >= threshold."""
        rule = PriceSpikeRule()
        sample_trade_event.price = 150.0
        context = {"benchmark_price": 200.0}  # 25% below
        triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True
        assert "25.00%" in desc

    def test_not_triggered_below_threshold(self, sample_trade_event):
        rule = PriceSpikeRule()
        sample_trade_event.price = 205.0
        context = {"benchmark_price": 200.0}  # 2.5% deviation
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False
        assert score == 0.0

    def test_triggered_custom_threshold(self, sample_trade_event):
        rule = PriceSpikeRule()
        sample_trade_event.price = 210.0
        # 5% spike, custom 5% threshold — should trigger (>= 5.0)
        context = {"benchmark_price": 200.0, "price_spike_threshold_pct": 5.0}
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True

    def test_not_triggered_no_benchmark(self, sample_trade_event):
        rule = PriceSpikeRule()
        context = {}  # no benchmark_price or market_price
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False
        assert score == 0.0

    def test_not_triggered_zero_benchmark(self, sample_trade_event):
        rule = PriceSpikeRule()
        context = {"benchmark_price": 0}
        triggered, score, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is False

    def test_uses_market_price_key_as_fallback(self, sample_trade_event):
        rule = PriceSpikeRule()
        sample_trade_event.price = 240.0
        context = {"market_price": 200.0}  # uses "market_price" key
        triggered, _, _ = rule.evaluate(sample_trade_event, context=context)
        assert triggered is True

    def test_no_context_returns_false(self, sample_trade_event):
        rule = PriceSpikeRule()
        triggered, score, _ = rule.evaluate(sample_trade_event, context=None)
        assert triggered is False
        assert score == 0.0

    def test_rule_code(self):
        assert PriceSpikeRule.code == "PRICE_SPIKE"
