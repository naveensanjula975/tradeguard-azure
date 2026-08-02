import sys
import os
import pytest
from datetime import datetime, timezone
from shared.event_contracts import TradeEvent
from shared.schemas import EventType, OrderSide, OrderType

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

@pytest.fixture
def sample_trade_event():
    return TradeEvent(
        event_id="018f4df8-a82d-7d40-9152-e6a6a8fc3581",
        event_type=EventType.ORDER_CREATED,
        trader_id="TRD-1001",
        account_id="ACC-2001",
        instrument="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=100.0,
        price=210.50,
        timestamp=datetime.now(timezone.utc),
        device_id="DEVICE-501",
        ip_address="192.0.2.10",
        country="AU",
        is_new_device=False
    )
