from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from .base import BaseRiskRule

class UnusualVolumeRule(BaseRiskRule):
    code = "UNUSUAL_VOLUME"
    name = "Unusual Trading Volume"
    description = "Current volume exceeds 3x historical average volume for trader"
    default_severity = AlertSeverity.MEDIUM
    default_score = 50.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        hist_avg_vol = context.get("historical_avg_volume", 0.0) if context else 0.0
        if hist_avg_vol > 0 and event.quantity > 3 * hist_avg_vol:
            return True, self.default_score, f"Order quantity {event.quantity} exceeds 3x historical average ({hist_avg_vol})"
        return False, 0.0, None
