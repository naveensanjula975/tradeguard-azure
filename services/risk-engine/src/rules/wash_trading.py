from datetime import datetime, timezone
from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity
from services.risk-engine.src.rules.base import BaseRiskRule

class WashTradingRule(BaseRiskRule):
    code = "WASH_TRADING"
    name = "Wash Trading Detection"
    description = "Trader executes offsetting buy and sell orders on same instrument within short window"
    default_severity = AlertSeverity.CRITICAL
    default_score = 85.0

    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        if not context:
            return False, 0.0, None

        if context.get("wash_trade_detected"):
            return True, self.default_score, "Wash trade pattern detected via context flag"

        recent_trades = context.get("recent_trades", [])
        for trade in recent_trades:
            trader_id = trade.get("trader_id") if isinstance(trade, dict) else getattr(trade, "trader_id", None)
            instrument = trade.get("instrument") if isinstance(trade, dict) else getattr(trade, "instrument", None)
            side = trade.get("side") if isinstance(trade, dict) else getattr(trade, "side", None)
            ts = trade.get("timestamp") if isinstance(trade, dict) else getattr(trade, "timestamp", None)

            if trader_id == event.trader_id and instrument == event.instrument and str(side) != str(event.side):
                if ts and isinstance(ts, datetime):
                    time_diff = abs((event.timestamp - ts).total_seconds())
                    if time_diff <= 30.0:
                        return (
                            True,
                            self.default_score,
                            f"Wash trading detected: Offsetting {event.side} order matching recent trade within {time_diff:.1f}s on {event.instrument}"
                        )

        return False, 0.0, None
