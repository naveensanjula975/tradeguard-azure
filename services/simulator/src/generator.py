import random
import uuid
from datetime import datetime, timezone
from shared.event_contracts import TradeEvent
from shared.schemas.common import EventType, OrderSide, OrderType

INSTRUMENTS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA"]
COUNTRIES = ["AU", "US", "GB", "SG", "DE"]

def generate_random_trade_event(scenario: str = "normal") -> TradeEvent:
    event_id = str(uuid.uuid4())
    trader_id = f"TRD-{random.randint(1000, 1050)}"
    account_id = f"ACC-{random.randint(2000, 2050)}"
    instrument = random.choice(INSTRUMENTS)
    side = random.choice([OrderSide.BUY, OrderSide.SELL])
    order_type = OrderType.LIMIT
    timestamp = datetime.now(timezone.utc)
    
    device_id = f"DEVICE-{random.randint(500, 520)}"
    ip_address = f"192.0.2.{random.randint(1, 254)}"
    country = random.choice(COUNTRIES)
    is_new_device = False

    if scenario == "large_order":
        quantity = 1000.0
        price = 150.0 # order_value = 150,000 >= 100,000
    elif scenario == "new_device_high_value":
        is_new_device = True
        quantity = 500.0
        price = 120.0 # order_value = 60,000 >= 50,000
        device_id = f"DEVICE-NEW-{uuid.uuid4().hex[:6]}"
    else:
        quantity = round(random.uniform(10, 200), 2)
        price = round(random.uniform(50, 300), 2)

    return TradeEvent(
        event_id=event_id,
        event_type=EventType.ORDER_CREATED,
        trader_id=trader_id,
        account_id=account_id,
        instrument=instrument,
        side=side,
        order_type=order_type,
        quantity=quantity,
        price=price,
        timestamp=timestamp,
        device_id=device_id,
        ip_address=ip_address,
        country=country,
        is_new_device=is_new_device
    )
