from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from .base import BaseRiskRule

class OffHoursTradingRule(BaseRiskRule):
    code = "OFF_HOURS_TRADING"
    name = "Off-Hours Trading Detection"
    description = "High-value trade order placed outside standard market operating hours or on weekends"
    default_severity = AlertSeverity.MEDIUM
    default_score = 50.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        threshold = context.get("off_hours_threshold", 25000.0) if context else 25000.0
        start_hour = context.get("market_start_hour_utc", 8) if context else 8
        end_hour = context.get("market_end_hour_utc", 18) if context else 18

        ts = event.timestamp
        is_weekend = ts.weekday() >= 5  # 5 = Saturday, 6 = Sunday
        is_outside_hours = ts.hour < start_hour or ts.hour >= end_hour

        if (is_weekend or is_outside_hours) and event.order_value >= threshold:
            reason = "weekend" if is_weekend else f"outside {start_hour:02d}:00-{end_hour:02d}:00 UTC"
            return (
                True,
                self.default_score,
                f"Off-hours trade of ${event.order_value:,.2f} placed {reason} (exceeds threshold ${threshold:,.2f})"
            )

        return False, 0.0, None
