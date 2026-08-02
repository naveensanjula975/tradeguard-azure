"""Alert Processor Service."""
from shared.event_contracts import AlertEvent
from shared.observability import setup_logger

logger = setup_logger("alert-processor")

class AlertProcessor:
    def process_incoming_alert(self, alert: AlertEvent):
        logger.info(f"Processing incoming alert {alert.alert_id} ({alert.severity})")
        # Save to database record

alert_processor = AlertProcessor()
