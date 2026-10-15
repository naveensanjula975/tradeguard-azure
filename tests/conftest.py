import sys
import os
import pytest
from datetime import datetime, timezone
from shared.event_contracts import TradeEvent
from shared.schemas import EventType, OrderSide, OrderType

# Add root directory to sys.path
_repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

import types
_services_dir = os.path.join(_repo_root, "services")
if os.path.isdir(_services_dir):
    if "services" not in sys.modules:
        _services_mod = types.ModuleType("services")
        _services_mod.__path__ = [_services_dir]
        sys.modules["services"] = _services_mod

    for _folder in os.listdir(_services_dir):
        if "-" in _folder:
            _alias = f"services.{_folder.replace('-', '_')}"
            _target = os.path.join(_services_dir, _folder)
            if os.path.isdir(_target) and _alias not in sys.modules:
                _mod = types.ModuleType(_alias)
                _mod.__path__ = [_target]
                sys.modules[_alias] = _mod
                setattr(sys.modules["services"], _folder.replace("-", "_"), _mod)

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
