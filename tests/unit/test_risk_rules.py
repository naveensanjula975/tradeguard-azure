from datetime import datetime, timezone, timedelta
from shared.schemas import EventType, OrderSide
from services.risk-engine.src.rules import (
    LargeOrderRule,
    NewDeviceHighValueRule,
    RapidCancellationRule,
    ExcessiveTradingFrequencyRule,
    UnusualVolumeRule,
    WashTradingRule,
    SpoofingLayeringRule,
    OffHoursTradingRule,
    PriceSpikeRule
)

def test_large_order_rule_triggered(sample_trade_event):
    rule = LargeOrderRule()
    sample_trade_event.quantity = 1000.0
    sample_trade_event.price = 150.0  # $150,000 >= $100,000
    triggered, score, desc = rule.evaluate(sample_trade_event)
    assert triggered is True
    assert score == 75.0

def test_large_order_rule_not_triggered(sample_trade_event):
    rule = LargeOrderRule()
    sample_trade_event.quantity = 10.0
    sample_trade_event.price = 100.0  # $1,000 < $100,000
    triggered, score, desc = rule.evaluate(sample_trade_event)
    assert triggered is False

def test_new_device_high_value_rule(sample_trade_event):
    rule = NewDeviceHighValueRule()
    sample_trade_event.is_new_device = True
    sample_trade_event.quantity = 500.0
    sample_trade_event.price = 120.0  # $60,000 >= $50,000
    triggered, score, desc = rule.evaluate(sample_trade_event)
    assert triggered is True
    assert score == 90.0

def test_wash_trading_rule_triggered(sample_trade_event):
    rule = WashTradingRule()
    recent_trade = {
        "trader_id": sample_trade_event.trader_id,
        "instrument": sample_trade_event.instrument,
        "side": OrderSide.SELL,
        "timestamp": sample_trade_event.timestamp - timedelta(seconds=10)
    }
    context = {"recent_trades": [recent_trade]}
    triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
    assert triggered is True
    assert score == 85.0
    assert "Wash trading detected" in desc

def test_wash_trading_rule_flag_triggered(sample_trade_event):
    rule = WashTradingRule()
    context = {"wash_trade_detected": True}
    triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
    assert triggered is True
    assert score == 85.0

def test_spoofing_layering_rule_triggered(sample_trade_event):
    rule = SpoofingLayeringRule()
    sample_trade_event.event_type = EventType.ORDER_CANCELLED
    context = {"cancellations_within_1m": 6}
    triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
    assert triggered is True
    assert score == 75.0

def test_off_hours_trading_rule_triggered(sample_trade_event):
    rule = OffHoursTradingRule()
    sample_trade_event.quantity = 200.0
    sample_trade_event.price = 200.0  # $40,000 >= $25,000
    sample_trade_event.timestamp = datetime(2026, 8, 2, 2, 0, 0, tzinfo=timezone.utc)  # Sunday 02:00
    triggered, score, desc = rule.evaluate(sample_trade_event)
    assert triggered is True
    assert score == 50.0

def test_off_hours_trading_rule_not_triggered(sample_trade_event):
    rule = OffHoursTradingRule()
    sample_trade_event.quantity = 10.0
    sample_trade_event.price = 100.0  # $1,000 < $25,000
    sample_trade_event.timestamp = datetime(2026, 8, 3, 10, 0, 0, tzinfo=timezone.utc)  # Monday 10:00
    triggered, score, desc = rule.evaluate(sample_trade_event)
    assert triggered is False

def test_price_spike_rule_triggered(sample_trade_event):
    rule = PriceSpikeRule()
    sample_trade_event.price = 250.0
    context = {"benchmark_price": 200.0}  # 25% deviation >= 15%
    triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
    assert triggered is True
    assert score == 70.0
    assert "deviates by 25.00%" in desc

def test_price_spike_rule_not_triggered(sample_trade_event):
    rule = PriceSpikeRule()
    sample_trade_event.price = 205.0
    context = {"benchmark_price": 200.0}  # 2.5% deviation < 15%
    triggered, score, desc = rule.evaluate(sample_trade_event, context=context)
    assert triggered is False
