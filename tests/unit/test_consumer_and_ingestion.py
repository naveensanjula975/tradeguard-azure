"""
Unit tests for EventConsumer (risk-engine):
  - _get_anomaly_score: success, fallback on HTTP error, fallback on generic exception
  - _forward_alert:     success, failure on HTTP error, failure on generic exception
  - process_event:      full pipeline — alert triggered, no alert, anomaly forwarded

Uses unittest.mock to intercept httpx and the evaluator singleton.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from shared.event_contracts import TradeEvent
from shared.schemas import EventType, OrderSide, OrderType, AlertSeverity
from services.risk_engine.src.consumer import EventConsumer


@pytest.fixture
def sample_event():
    return TradeEvent(
        event_id="EVT-CONSUMER-001",
        event_type=EventType.ORDER_CREATED,
        trader_id="TRD-2000",
        account_id="ACC-3000",
        instrument="MSFT",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=200.0,
        price=300.0,
        timestamp=datetime.now(timezone.utc),
        device_id="DEV-200",
        ip_address="203.0.113.5",
        country="US",
        is_new_device=False,
    )


@pytest.fixture
def mock_alert():
    alert = MagicMock()
    alert.alert_id = "ALT-XXXXXX"
    alert.severity = AlertSeverity.HIGH
    alert.final_risk_score = 75.5
    alert.trader_id = "TRD-2000"
    alert.model_dump.return_value = {
        "alert_id": "ALT-XXXXXX",
        "severity": "HIGH",
        "final_risk_score": 75.5,
    }
    return alert


# ─────────────────────────────────────────────────────────────
# _get_anomaly_score
# ─────────────────────────────────────────────────────────────

class TestGetAnomalyScore:
    def test_returns_score_from_service(self, sample_event):
        consumer = EventConsumer()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"anomaly_score": 72.5}
        mock_resp.raise_for_status = MagicMock()
        with patch("services.risk_engine.src.consumer.httpx.post", return_value=mock_resp):
            score = consumer._get_anomaly_score(sample_event)
        assert score == 72.5

    def test_returns_0_on_http_error(self, sample_event):
        consumer = EventConsumer()
        with patch(
            "services.risk_engine.src.consumer.httpx.post",
            side_effect=Exception("Connection refused"),
        ):
            score = consumer._get_anomaly_score(sample_event)
        assert score == 0.0

    def test_returns_0_on_missing_key(self, sample_event):
        consumer = EventConsumer()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {}  # no "anomaly_score" key
        mock_resp.raise_for_status = MagicMock()
        with patch("services.risk_engine.src.consumer.httpx.post", return_value=mock_resp):
            score = consumer._get_anomaly_score(sample_event)
        assert score == 0.0

    def test_posts_correct_features(self, sample_event):
        consumer = EventConsumer()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"anomaly_score": 0.0}
        mock_resp.raise_for_status = MagicMock()
        with patch("services.risk_engine.src.consumer.httpx.post", return_value=mock_resp) as mock_post:
            consumer._get_anomaly_score(sample_event)
        posted_json = mock_post.call_args.kwargs["json"]
        assert "order_value" in posted_json
        assert "hour_of_activity" in posted_json
        assert posted_json["order_value"] == sample_event.order_value

    def test_new_device_flag_included_in_features(self, sample_event):
        consumer = EventConsumer()
        sample_event.is_new_device = True
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"anomaly_score": 0.0}
        mock_resp.raise_for_status = MagicMock()
        with patch("services.risk_engine.src.consumer.httpx.post", return_value=mock_resp) as mock_post:
            consumer._get_anomaly_score(sample_event)
        assert mock_post.call_args.kwargs["json"]["is_new_device"] == 1


# ─────────────────────────────────────────────────────────────
# _forward_alert
# ─────────────────────────────────────────────────────────────

class TestForwardAlert:
    def test_forward_success_returns_true(self):
        consumer = EventConsumer()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        with patch("services.risk_engine.src.consumer.httpx.post", return_value=mock_resp):
            result = consumer._forward_alert({"alert_id": "ALT-XXX"})
        assert result is True

    def test_forward_http_error_returns_false(self):
        consumer = EventConsumer()
        with patch(
            "services.risk_engine.src.consumer.httpx.post",
            side_effect=Exception("Alert service unreachable"),
        ):
            result = consumer._forward_alert({"alert_id": "ALT-XXX"})
        assert result is False

    def test_forward_posts_to_correct_url(self):
        consumer = EventConsumer()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        with patch(
            "services.risk_engine.src.consumer.httpx.post", return_value=mock_resp
        ) as mock_post, patch(
            "services.risk_engine.src.consumer.settings"
        ) as mock_settings:
            mock_settings.ALERT_CASE_SERVICE_URL = "http://alert-service:8002"
            consumer._forward_alert({"alert_id": "ALT-XXX"})
        call_url = mock_post.call_args[0][0]
        assert "api/v1/alerts" in call_url


# ─────────────────────────────────────────────────────────────
# process_event — full pipeline
# ─────────────────────────────────────────────────────────────

class TestProcessEvent:
    def test_process_event_returns_alert_dict_when_triggered(self, sample_event, mock_alert):
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=30.0), \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=mock_alert), \
             patch.object(consumer, "_forward_alert", return_value=True):
            result = consumer.process_event(sample_event)
        assert result is not None
        assert result["alert_id"] == "ALT-XXXXXX"

    def test_process_event_returns_none_when_no_alert(self, sample_event):
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=0.0), \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=None):
            result = consumer.process_event(sample_event)
        assert result is None

    def test_process_event_forwards_alert_when_triggered(self, sample_event, mock_alert):
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=50.0), \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=mock_alert), \
             patch.object(consumer, "_forward_alert", return_value=True) as mock_fwd:
            consumer.process_event(sample_event)
        mock_fwd.assert_called_once()

    def test_process_event_does_not_forward_when_no_alert(self, sample_event):
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=0.0), \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=None), \
             patch.object(consumer, "_forward_alert") as mock_fwd:
            consumer.process_event(sample_event)
        mock_fwd.assert_not_called()

    def test_process_event_uses_anomaly_score_in_evaluation(self, sample_event):
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=88.0) as mock_score, \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=None) as mock_eval, \
             patch.object(consumer, "_forward_alert"):
            consumer.process_event(sample_event)
        mock_eval.assert_called_once_with(sample_event, anomaly_score=88.0)

    def test_process_event_still_returns_alert_even_if_forward_fails(self, sample_event, mock_alert):
        """Alert dict is still returned even when forwarding fails (fire-and-forget)."""
        consumer = EventConsumer()
        with patch.object(consumer, "_get_anomaly_score", return_value=40.0), \
             patch("services.risk_engine.src.consumer.evaluator.evaluate_event", return_value=mock_alert), \
             patch.object(consumer, "_forward_alert", return_value=False):
            result = consumer.process_event(sample_event)
        assert result is not None


# ─────────────────────────────────────────────────────────────
# Ingestion API — extended trade event endpoint tests
# ─────────────────────────────────────────────────────────────

class TestIngestionAPIExtended:
    """Extended tests for POST /api/v1/trade-events and GET /api/v1/trade-events/{event_id}."""

    def _make_payload(self, event_id="EVT-UNIQUE-001"):
        return {
            "event_id": event_id,
            "event_type": "ORDER_CREATED",
            "trader_id": "TRD-1001",
            "account_id": "ACC-2001",
            "instrument": "AAPL",
            "side": "BUY",
            "order_type": "LIMIT",
            "quantity": 100.0,
            "price": 210.50,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "device_id": "DEVICE-501",
            "ip_address": "192.0.2.10",
            "country": "AU",
        }

    def test_post_trade_event_persists_and_forwards(self):
        from services.ingestion_service.src.main import app as ingest_app
        from shared.database.connection import get_db as ingest_get_db
        ingest_client = TestClient(ingest_app)

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("services.ingestion_service.src.api.v1.events.publisher") as mock_pub:
            mock_pub.publish_trade_event.return_value = True
            ingest_app.dependency_overrides[ingest_get_db] = lambda: mock_db
            response = ingest_client.post("/api/v1/trade-events", json=self._make_payload())
            ingest_app.dependency_overrides.clear()

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "accepted"
        assert "event_id" in data

    def test_post_trade_event_warning_when_forward_fails(self):
        from services.ingestion_service.src.main import app as ingest_app
        from shared.database.connection import get_db as ingest_get_db
        ingest_client = TestClient(ingest_app)

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("services.ingestion_service.src.api.v1.events.publisher") as mock_pub:
            mock_pub.publish_trade_event.return_value = False
            ingest_app.dependency_overrides[ingest_get_db] = lambda: mock_db
            response = ingest_client.post("/api/v1/trade-events", json=self._make_payload("EVT-FAIL-001"))
            ingest_app.dependency_overrides.clear()

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "accepted_with_warning"
        assert "warning" in data

    def test_get_trade_event_not_found_returns_404(self):
        from services.ingestion_service.src.main import app as ingest_app
        from shared.database.connection import get_db as ingest_get_db
        ingest_client = TestClient(ingest_app)

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        ingest_app.dependency_overrides[ingest_get_db] = lambda: mock_db
        response = ingest_client.get("/api/v1/trade-events/EVT-NOTFOUND")
        ingest_app.dependency_overrides.clear()

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_get_trade_event_found_returns_200(self):
        from services.ingestion_service.src.main import app as ingest_app
        from shared.database.connection import get_db as ingest_get_db
        ingest_client = TestClient(ingest_app)

        record = MagicMock()
        record.event_id = "EVT-FOUND-001"
        record.trader_id = "TRD-1001"
        record.instrument = "AAPL"
        record.event_type = "ORDER_CREATED"
        record.received_at = datetime.now(timezone.utc)

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = record
        ingest_app.dependency_overrides[ingest_get_db] = lambda: mock_db
        response = ingest_client.get("/api/v1/trade-events/EVT-FOUND-001")
        ingest_app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == "EVT-FOUND-001"
        assert data["status"] == "processed"

    def test_post_trade_event_invalid_side_returns_422(self):
        from services.ingestion_service.src.main import app as ingest_app
        ingest_client = TestClient(ingest_app)
        payload = self._make_payload()
        payload["side"] = "SHORT"  # not a valid OrderSide
        response = ingest_client.post("/api/v1/trade-events", json=payload)
        assert response.status_code == 422

    def test_post_trade_event_negative_quantity_returns_422(self):
        from services.ingestion_service.src.main import app as ingest_app
        ingest_client = TestClient(ingest_app)
        payload = self._make_payload()
        payload["quantity"] = -10.0
        response = ingest_client.post("/api/v1/trade-events", json=payload)
        assert response.status_code == 422
