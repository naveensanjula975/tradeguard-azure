from services.risk-engine.src.rules import (
    LargeOrderRule,
    NewDeviceHighValueRule,
    RapidCancellationRule,
    ExcessiveTradingFrequencyRule,
    UnusualVolumeRule
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
