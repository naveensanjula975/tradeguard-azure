from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from .base import BaseRiskRule

class ExcessiveTradingFrequencyRule(BaseRiskRule):
    code = "EXCESSIVE_FREQUENCY"
    name = "Excessive Trading Frequency"
    description = "Trader submits more than 30 orders within 1 minute"
    default_severity = AlertSeverity.MEDIUM
    default_score = 50.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        orders_last_1m = context.get("orders_last_1m", 0) if context else 0
        if orders_last_1m > 30:
            return True, self.default_score, f"Trader submitted {orders_last_1m} orders in 1 minute"
        return False, 0.0, None
