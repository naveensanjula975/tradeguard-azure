from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from shared.schemas.common import EventType, OrderSide, OrderType

class TradeEvent(BaseModel):
    event_id: str = Field(..., description="Unique event identifier UUID")
    event_type: EventType = Field(..., description="Type of trading event")
    trader_id: str = Field(..., description="Trader identifier e.g. TRD-1001")
    account_id: str = Field(..., description="Trading account identifier e.g. ACC-2001")
    instrument: str = Field(..., description="Financial ticker/symbol e.g. AAPL")
    side: OrderSide = Field(..., description="Order side BUY or SELL")
    order_type: OrderType = Field(default=OrderType.LIMIT, description="Order type LIMIT, MARKET, STOP")
    quantity: float = Field(..., gt=0, description="Order quantity")
    price: float = Field(..., gt=0, description="Price per unit")
    timestamp: datetime = Field(..., description="Event timestamp in UTC")
    device_id: str = Field(..., description="Device identifier e.g. DEVICE-501")
    ip_address: str = Field(..., description="IP address of trader device")
    country: str = Field(..., description="ISO Country code e.g. AU")
    is_new_device: Optional[bool] = Field(default=False, description="Flag indicating new device")

    @property
    def order_value(self) -> float:
        return self.quantity * self.price
