from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from .base import BaseRiskRule

class RapidCancellationRule(BaseRiskRule):
    code = "RAPID_CANCELLATION"
    name = "Rapid Cancellation Detection"
    description = "Trader cancels at least 10 orders within 5 minutes"
    default_severity = AlertSeverity.HIGH
    default_score = 75.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        cancellations_last_5m = context.get("cancellations_last_5m", 0) if context else 0
        if cancellations_last_5m >= 10:
            return True, self.default_score, f"Trader cancelled {cancellations_last_5m} orders in 5 minutes"
        return False, 0.0, None
