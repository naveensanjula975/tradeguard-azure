from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from services.risk-engine.src.rules.base import BaseRiskRule

class PriceSpikeRule(BaseRiskRule):
    code = "PRICE_SPIKE"
    name = "Price Spike Deviation Detection"
    description = "Order price deviates significantly from baseline/benchmark market price"
    default_severity = AlertSeverity.HIGH
    default_score = 70.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        if not context:
            return False, 0.0, None

        benchmark_price = context.get("benchmark_price") or context.get("market_price")
        if not benchmark_price or benchmark_price <= 0:
            return False, 0.0, None

        threshold_pct = context.get("price_spike_threshold_pct", 15.0)
        deviation_pct = abs(event.price - benchmark_price) / benchmark_price * 100.0

        if deviation_pct >= threshold_pct:
            return (
                True,
                self.default_score,
                f"Order price ${event.price:,.2f} deviates by {deviation_pct:.2f}% from benchmark ${benchmark_price:,.2f} (threshold {threshold_pct:.1f}%)"
            )

        return False, 0.0, None
