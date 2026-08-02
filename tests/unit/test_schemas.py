import pytest
from pydantic import ValidationError
from shared.event_contracts import TradeEvent
from shared.schemas import EventType, OrderSide

def test_trade_event_validation(sample_trade_event):
    assert sample_trade_event.trader_id == "TRD-1001"
    assert sample_trade_event.order_value == 21050.0

def test_trade_event_invalid_quantity(sample_trade_event):
    with pytest.raises(ValidationError):
        TradeEvent(
            event_id="018f4df8-a82d-7d40-9152-e6a6a8fc3581",
            event_type=EventType.ORDER_CREATED,
            trader_id="TRD-1001",
            account_id="ACC-2001",
            instrument="AAPL",
            side=OrderSide.BUY,
            quantity=-50.0,  # Invalid negative quantity
            price=210.50,
            timestamp="2026-07-26T10:30:00Z",
            device_id="DEVICE-501",
            ip_address="192.0.2.10",
            country="AU"
        )
