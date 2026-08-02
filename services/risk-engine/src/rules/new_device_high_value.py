from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from services.risk-engine.src.rules.base import BaseRiskRule

class NewDeviceHighValueRule(BaseRiskRule):
    code = "NEW_DEVICE_HIGH_VALUE"
    name = "New Device & High-Value Order"
    description = "New device indicator is true AND order value >= 50,000"
    default_severity = AlertSeverity.CRITICAL
    default_score = 90.0
    threshold = 50000.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        is_new_device = getattr(event, "is_new_device", False)
        order_val = event.order_value
        if is_new_device and order_val >= self.threshold:
            return True, self.default_score, f"High value order (${order_val:,.2f}) placed from unrecognized device ({event.device_id})"
        return False, 0.0, None
