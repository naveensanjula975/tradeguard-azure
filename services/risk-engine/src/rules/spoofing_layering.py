from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity, EventType
from services.risk-engine.src.rules.base import BaseRiskRule

class SpoofingLayeringRule(BaseRiskRule):
    code = "SPOOFING_LAYERING"
    name = "Spoofing / Layering Detection"
    description = "Rapid submission and cancellation of non-executable orders prior to trade execution"
    default_severity = AlertSeverity.HIGH
    default_score = 75.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        if not context:
            return False, 0.0, None

        if context.get("spoofing_pattern_detected"):
            return True, self.default_score, "Spoofing / layering pattern flagged by surveillance context"

        cancellations_1m = context.get("cancellations_within_1m", 0)
        rapid_cancellation_ratio = context.get("cancellation_ratio", 0.0)

        if event.event_type == EventType.ORDER_CANCELLED and cancellations_1m >= 5:
            return (
                True,
                self.default_score,
                f"Potential spoofing pattern: {cancellations_1m} order cancellations within 1 minute window"
            )

        if rapid_cancellation_ratio >= 0.8 and context.get("total_orders_1m", 0) >= 5:
            return (
                True,
                self.default_score,
                f"High cancellation-to-order ratio ({rapid_cancellation_ratio:.0%}) detected for trader {event.trader_id}"
            )

        return False, 0.0, None
