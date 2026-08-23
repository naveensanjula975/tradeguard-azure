"""
Unit tests for EventPublisher (ingestion-service).
Uses unittest.mock to intercept httpx HTTP calls.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from shared.event_contracts import TradeEvent
from shared.schemas import EventType, OrderSide, OrderType


@pytest.fixture
def sample_event():
    return TradeEvent(
        event_id="018f4df8-a82d-7d40-9152-e6a6a8fc3581",
        event_type=EventType.ORDER_CREATED,
        trader_id="TRD-1001",
        account_id="ACC-2001",
        instrument="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=100.0,
        price=210.50,
        timestamp=datetime.now(timezone.utc),
        device_id="DEVICE-501",
        ip_address="192.0.2.10",
        country="AU",
        is_new_device=False,
    )


class TestEventPublisherDevelopment:
    """Tests for the development/local environment path (HTTP forwarding)."""

    def test_publish_success_returns_true(self, sample_event):
        with patch("services.ingestion_service.src.publisher.settings") as mock_settings, \
             patch("services.ingestion_service.src.publisher.httpx.post") as mock_post:

            mock_settings.ENVIRONMENT = "development"
            mock_settings.RISK_ENGINE_URL = "http://localhost:8001"

            mock_response = MagicMock()
            mock_response.json.return_value = {"status": "ok"}
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            from services.ingestion_service.src.publisher import EventPublisher
            publisher = EventPublisher()
            result = publisher.publish_trade_event(sample_event)

            assert result is True
            mock_post.assert_called_once()

    def test_publish_calls_correct_endpoint(self, sample_event):
        with patch("services.ingestion_service.src.publisher.settings") as mock_settings, \
             patch("services.ingestion_service.src.publisher.httpx.post") as mock_post:

            mock_settings.ENVIRONMENT = "development"
            mock_settings.RISK_ENGINE_URL = "http://risk-engine:8001"

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = {}
            mock_post.return_value = mock_response

            from services.ingestion_service.src.publisher import EventPublisher
            publisher = EventPublisher()
            publisher.publish_trade_event(sample_event)

            call_url = mock_post.call_args[0][0]
            assert call_url == "http://risk-engine:8001/api/v1/evaluate"

    def test_publish_http_error_returns_false(self, sample_event):
        import httpx

        with patch("services.ingestion_service.src.publisher.settings") as mock_settings, \
             patch("services.ingestion_service.src.publisher.httpx.post") as mock_post:

            mock_settings.ENVIRONMENT = "development"
            mock_settings.RISK_ENGINE_URL = "http://localhost:8001"

            error_response = MagicMock()
            error_response.status_code = 500
            error_response.text = "Internal Server Error"
            mock_post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError(
                "500 error", request=MagicMock(), response=error_response
            )

            from services.ingestion_service.src.publisher import EventPublisher
            publisher = EventPublisher()
            result = publisher.publish_trade_event(sample_event)

            assert result is False

    def test_publish_connection_error_returns_false(self, sample_event):
        with patch("services.ingestion_service.src.publisher.settings") as mock_settings, \
             patch("services.ingestion_service.src.publisher.httpx.post") as mock_post:

            mock_settings.ENVIRONMENT = "development"
            mock_settings.RISK_ENGINE_URL = "http://localhost:8001"
            mock_post.side_effect = Exception("Connection refused")

            from services.ingestion_service.src.publisher import EventPublisher
            publisher = EventPublisher()
            result = publisher.publish_trade_event(sample_event)

            assert result is False


class TestEventPublisherProduction:
    """Tests for the production environment path (Azure Event Hubs stub)."""

    def test_production_returns_true_without_http_call(self, sample_event):
        with patch("services.ingestion_service.src.publisher.settings") as mock_settings, \
             patch("services.ingestion_service.src.publisher.httpx.post") as mock_post:

            mock_settings.ENVIRONMENT = "production"

            from services.ingestion_service.src.publisher import EventPublisher
            publisher = EventPublisher()
            result = publisher.publish_trade_event(sample_event)

            assert result is True
            mock_post.assert_not_called()  # No HTTP in production


# ─────────────────────────────────────────────────────────────
# TradeEvent model property tests
# ─────────────────────────────────────────────────────────────

class TestTradeEventModel:
    def test_order_value_calculation(self, sample_event):
        """order_value is a computed property: quantity * price"""
        sample_event.quantity = 100.0
        sample_event.price = 210.50
        assert sample_event.order_value == pytest.approx(21050.0)

    def test_order_value_large(self, sample_event):
        sample_event.quantity = 5000.0
        sample_event.price = 500.0
        assert sample_event.order_value == 2_500_000.0

    def test_is_new_device_defaults_false(self):
        event = TradeEvent(
            event_id="abc-123",
            event_type=EventType.ORDER_CREATED,
            trader_id="TRD-2000",
            account_id="ACC-3000",
            instrument="MSFT",
            side=OrderSide.SELL,
            order_type=OrderType.MARKET,
            quantity=50.0,
            price=300.0,
            timestamp=datetime.now(timezone.utc),
            device_id="DEV-100",
            ip_address="10.0.0.1",
            country="US",
        )
        assert event.is_new_device is False

    def test_pydantic_validation_rejects_zero_quantity(self):
        with pytest.raises(Exception):
            TradeEvent(
                event_id="bad-event",
                event_type=EventType.ORDER_CREATED,
                trader_id="TRD-1",
                account_id="ACC-1",
                instrument="AAPL",
                side=OrderSide.BUY,
                order_type=OrderType.LIMIT,
                quantity=0.0,  # must be > 0
                price=100.0,
                timestamp=datetime.now(timezone.utc),
                device_id="DEV-1",
                ip_address="1.2.3.4",
                country="AU",
            )

    def test_pydantic_validation_rejects_zero_price(self):
        with pytest.raises(Exception):
            TradeEvent(
                event_id="bad-event",
                event_type=EventType.ORDER_CREATED,
                trader_id="TRD-1",
                account_id="ACC-1",
                instrument="AAPL",
                side=OrderSide.BUY,
                order_type=OrderType.LIMIT,
                quantity=100.0,
                price=0.0,  # must be > 0
                timestamp=datetime.now(timezone.utc),
                device_id="DEV-1",
                ip_address="1.2.3.4",
                country="AU",
            )
