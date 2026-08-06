import httpx
from shared.event_contracts import TradeEvent
from shared.observability import setup_logger
from services.risk_engine.src.evaluator import evaluator
from services.risk_engine.src.config import settings

logger = setup_logger("risk-engine-consumer")


class EventConsumer:
    def _get_anomaly_score(self, event: TradeEvent) -> float:
        """Call the anomaly service to get an ML anomaly score for this event."""
        features = {
            "order_value": event.order_value,
            "orders_per_minute": 1.0,        # In a real pipeline this would be computed from a window
            "cancellation_rate": 0.0,         # Would come from trader session context
            "volume_ratio": 1.0,              # Relative to 30-day average
            "instruments_traded": 1,
            "hour_of_activity": event.timestamp.hour,
            "is_new_device": int(event.is_new_device or False),
        }
        try:
            resp = httpx.post(
                f"{settings.ANOMALY_SERVICE_URL}/api/v1/predict",
                json=features,
                timeout=5.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return float(data.get("anomaly_score", 0.0))
        except Exception as e:
            logger.warning(f"Anomaly service unavailable for event {event.event_id}: {e} — using score 0.0")
            return 0.0

    def _forward_alert(self, alert_dict: dict) -> bool:
        """Forward a generated alert to the alert-case-service for persistence."""
        try:
            resp = httpx.post(
                f"{settings.ALERT_CASE_SERVICE_URL}/api/v1/alerts",
                json=alert_dict,
                timeout=5.0,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to forward alert to alert-case-service: {e}")
            return False

    def process_event(self, event: TradeEvent) -> dict | None:
        """Evaluate a trade event: get ML score, apply rules, forward alert if triggered."""
        logger.info(f"Consuming trade event {event.event_id} for trader {event.trader_id}")

        anomaly_score = self._get_anomaly_score(event)
        alert = evaluator.evaluate_event(event, anomaly_score=anomaly_score)

        if alert:
            logger.warning(
                f"Alert generated: {alert.alert_id} ({alert.severity}) "
                f"risk_score={alert.final_risk_score} trader={alert.trader_id}"
            )
            alert_dict = alert.model_dump(mode="json")
            self._forward_alert(alert_dict)
            return alert_dict

        logger.info(f"No alert triggered for event {event.event_id} (anomaly_score={anomaly_score})")
        return None


consumer = EventConsumer()
