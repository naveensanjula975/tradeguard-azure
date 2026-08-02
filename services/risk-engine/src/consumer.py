from shared.event_contracts import TradeEvent
from shared.observability import setup_logger
from services.risk-engine.src.evaluator import evaluator

logger = setup_logger("risk-engine-consumer")

class EventConsumer:
    def process_event(self, event: TradeEvent):
        logger.info(f"Consuming trade event {event.event_id}")
        # In real workflow: fetch ML score from anomaly service & send created alert to Service Bus
        alert = evaluator.evaluate_event(event, anomaly_score=10.0)
        if alert:
            logger.warn(f"Alert generated: {alert.alert_id} ({alert.severity}) for trader {alert.trader_id}")
        return alert

consumer = EventConsumer()
