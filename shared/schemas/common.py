from enum import Enum
from pydantic import BaseModel, Field

class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AlertStatus(str, Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    ESCALATED = "ESCALATED"
    CONFIRMED = "CONFIRMED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    CLOSED = "CLOSED"

class EventType(str, Enum):
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    ORDER_EXECUTED = "ORDER_EXECUTED"

class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class OrderType(str, Enum):
    LIMIT = "LIMIT"
    MARKET = "MARKET"
    STOP = "STOP"

class HealthResponse(BaseModel):
    status: str = Field(default="healthy")
    service: str
    version: str = Field(default="0.1.0")
