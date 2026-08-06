import os
import httpx
from shared.event_contracts import TradeEvent
from shared.observability import setup_logger
from services.ingestion_service.src.config import settings

logger = setup_logger("ingestion-publisher")


class EventPublisher:
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.risk_engine_url = settings.RISK_ENGINE_URL

    def publish_trade_event(self, event: TradeEvent) -> bool:
        """
        Publishes a validated trade event for risk evaluation.

        Local/dev mode: synchronously calls the risk-engine REST endpoint.
        Cloud mode: would publish to Azure Event Hubs (add Azure SDK call here).
        """
        if self.environment == "production":
            # TODO: Replace with Azure Event Hubs SDK call
            # from azure.eventhub import EventHubProducerClient, EventData
            # producer = EventHubProducerClient.from_connection_string(
            #     conn_str=settings.EVENT_HUBS_CONNECTION_STRING,
            #     eventhub_name=settings.EVENT_HUBS_NAME,
            # )
            # with producer:
            #     batch = producer.create_batch()
            #     batch.add(EventData(event.model_dump_json()))
            #     producer.send_batch(batch)
            logger.info(f"[PROD] Would publish event {event.event_id} to Azure Event Hubs")
            return True

        # Local / development: call risk engine directly via HTTP
        try:
            logger.info(f"Forwarding event {event.event_id} to risk engine at {self.risk_engine_url}")
            resp = httpx.post(
                f"{self.risk_engine_url}/api/v1/evaluate",
                json=event.model_dump(mode="json"),
                timeout=10.0,
            )
            resp.raise_for_status()
            result = resp.json()
            status_msg = result.get("status", "unknown")
            logger.info(f"Risk engine responded for event {event.event_id}: status={status_msg}")
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Risk engine returned error for event {event.event_id}: {e.response.status_code} {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Failed to reach risk engine for event {event.event_id}: {e}")
            return False


publisher = EventPublisher()
