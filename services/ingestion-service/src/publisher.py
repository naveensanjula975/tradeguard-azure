import os
import httpx
from shared.event_contracts import TradeEvent
from shared.observability import setup_logger
from .config import settings

logger = setup_logger("ingestion-publisher")


class EventPublisher:
    def __init__(self):
        self.environment = settings.ENVIRONMENT

    def publish_trade_event(self, event: TradeEvent) -> bool:
        """
        Routes a validated trade event for risk evaluation.
        - development: synchronous HTTP call to risk-engine
        - production: publishes to Azure Event Hubs (stub — add Azure SDK call)
        """
        if self.environment == "production":
            # TODO: Replace with Azure Event Hubs SDK
            # from azure.eventhub import EventHubProducerClient, EventData
            # producer = EventHubProducerClient.from_connection_string(...)
            logger.info(f"[PROD] Would publish event {event.event_id} to Azure Event Hubs")
            return True

        # Local/development: direct HTTP to risk engine
        try:
            logger.info(f"Forwarding event {event.event_id} to risk engine at {settings.RISK_ENGINE_URL}")
            resp = httpx.post(
                f"{settings.RISK_ENGINE_URL}/api/v1/evaluate",
                json=event.model_dump(mode="json"),
                timeout=10.0,
            )
            resp.raise_for_status()
            result = resp.json()
            logger.info(f"Risk engine responded for event {event.event_id}: status={result.get('status')}")
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Risk engine error for {event.event_id}: {e.response.status_code} {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Failed to reach risk engine for {event.event_id}: {e}")
            return False


publisher = EventPublisher()
