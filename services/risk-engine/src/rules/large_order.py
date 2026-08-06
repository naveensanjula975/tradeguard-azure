from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from .base import BaseRiskRule

class LargeOrderRule(BaseRiskRule):
    code = "LARGE_ORDER"
    name = "Large Order Detection"
    description = "Order value (quantity * price) >= 100,000"
    default_severity = AlertSeverity.HIGH
    default_score = 75.0
    threshold = 100000.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        order_val = event.order_value
        if order_val >= self.threshold:
            return True, self.default_score, f"Order value ${order_val:,.2f} exceeds threshold ${self.threshold:,.2f}"
        return False, 0.0, None
