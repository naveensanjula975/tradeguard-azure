"""
API integration tests for the Alert Case Service:
  - GET  /api/v1/alerts          (list with filters, pagination)
  - POST /api/v1/alerts          (ingest new alert, duplicate detection)
  - GET  /api/v1/alerts/{id}     (retrieve single alert, 404)
  - PATCH /api/v1/alerts/{id}/status  (update status, 404)
  - PATCH /api/v1/alerts/{id}/assign  (assign analyst, 404)

All DB calls are intercepted via FastAPI dependency_overrides.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from services.alert_case_service.src.main import app
from shared.database.connection import get_db
from shared.schemas.common import AlertSeverity, AlertStatus


client = TestClient(app)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _mock_alert_record(
    alert_id="ALT-AABBCC",
    trader_id="TRD-1001",
    rule_code="LARGE_ORDER",
    severity=AlertSeverity.HIGH.value,
    status=AlertStatus.NEW.value,
    final_risk_score=77.1,
    assigned_to=None,
):
    record = MagicMock()
    record.alert_id = alert_id
    record.event_id = "EVT-0001"
    record.trader_id = trader_id
    record.rule_code = rule_code
    record.title = "Test Alert"
    record.description = "A test description"
    record.rule_score = 75.0
    record.anomaly_score = 10.0
    record.final_risk_score = final_risk_score
    record.severity = severity
    record.status = status
    record.assigned_to = assigned_to
    record.detected_at = datetime.now(timezone.utc)
    record.to_dict.return_value = {
        "alert_id": alert_id,
        "trader_id": trader_id,
        "rule_code": rule_code,
        "severity": severity,
        "status": status,
        "final_risk_score": final_risk_score,
        "assigned_to": assigned_to,
    }
    return record


def _alert_event_payload(alert_id="ALT-AABBCC"):
    return {
        "alert_id": alert_id,
        "event_id": "018f4df8-a82d-7d40-9152-e6a6a8fc3581",
        "trader_id": "TRD-1001",
        "rule_code": "LARGE_ORDER",
        "title": "Large Order Detection",
        "description": "Order value exceeds threshold",
        "rule_score": 75.0,
        "anomaly_score": 10.0,
        "final_risk_score": 55.5,
        "severity": "HIGH",
        "status": "NEW",
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_service_name(self):
        data = client.get("/health").json()
        assert data["service"] == "alert-case-service"
        assert data["status"] == "healthy"

    def test_health_version_field_present(self):
        data = client.get("/health").json()
        assert "version" in data


# ─────────────────────────────────────────────────────────────
# GET /api/v1/alerts — list alerts
# ─────────────────────────────────────────────────────────────

class TestListAlerts:
    def _setup_empty_db(self):
        mock_db = MagicMock()
        # Support both chained .filter().count() and direct .count()
        mock_db.query.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
        return mock_db

    def test_list_alerts_returns_200(self):
        mock_db = self._setup_empty_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/alerts")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_list_alerts_empty_response_structure(self):
        mock_db = self._setup_empty_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/alerts").json()
        app.dependency_overrides.clear()
        assert "total" in data
        assert "items" in data
        assert "limit" in data
        assert "offset" in data

    def test_list_alerts_default_pagination(self):
        mock_db = self._setup_empty_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/alerts").json()
        app.dependency_overrides.clear()
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_list_alerts_custom_pagination(self):
        mock_db = self._setup_empty_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/alerts?limit=10&offset=20").json()
        app.dependency_overrides.clear()
        assert data["limit"] == 10
        assert data["offset"] == 20

    def test_list_alerts_with_records(self):
        mock_db = MagicMock()
        record = _mock_alert_record()
        mock_db.query.return_value.count.return_value = 1
        mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [record]
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/alerts").json()
        app.dependency_overrides.clear()
        assert data["total"] == 1
        assert len(data["items"]) == 1

    def test_list_alerts_invalid_limit_rejected(self):
        response = client.get("/api/v1/alerts?limit=0")
        assert response.status_code == 422  # FastAPI validation

    def test_list_alerts_limit_above_max_rejected(self):
        response = client.get("/api/v1/alerts?limit=201")
        assert response.status_code == 422

    def test_list_alerts_negative_offset_rejected(self):
        response = client.get("/api/v1/alerts?offset=-1")
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────
# POST /api/v1/alerts — ingest alert
# ─────────────────────────────────────────────────────────────

class TestIngestAlert:
    def test_ingest_new_alert_returns_201(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        record = _mock_alert_record()
        with patch(
            "services.alert_case_service.src.api.v1.alerts.alert_processor.process_incoming_alert",
            return_value=record,
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.post("/api/v1/alerts", json=_alert_event_payload())
            app.dependency_overrides.clear()
        assert response.status_code == 201

    def test_ingest_alert_missing_required_field_returns_422(self):
        payload = _alert_event_payload()
        del payload["trader_id"]
        response = client.post("/api/v1/alerts", json=payload)
        assert response.status_code == 422

    def test_ingest_alert_invalid_severity_returns_422(self):
        payload = _alert_event_payload()
        payload["severity"] = "EXTREME"  # not a valid AlertSeverity
        response = client.post("/api/v1/alerts", json=payload)
        assert response.status_code == 422

    def test_ingest_alert_score_out_of_range_returns_422(self):
        payload = _alert_event_payload()
        payload["rule_score"] = 150.0  # must be 0–100
        response = client.post("/api/v1/alerts", json=payload)
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────
# GET /api/v1/alerts/{alert_id}
# ─────────────────────────────────────────────────────────────

class TestGetAlert:
    def test_get_existing_alert_returns_200(self):
        mock_db = MagicMock()
        record = _mock_alert_record(alert_id="ALT-7001")
        mock_db.query.return_value.filter.return_value.first.return_value = record
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/alerts/ALT-7001")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_get_existing_alert_response_body(self):
        mock_db = MagicMock()
        record = _mock_alert_record(alert_id="ALT-7001", trader_id="TRD-1001")
        mock_db.query.return_value.filter.return_value.first.return_value = record
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/alerts/ALT-7001").json()
        app.dependency_overrides.clear()
        assert data["alert_id"] == "ALT-7001"
        assert data["trader_id"] == "TRD-1001"

    def test_get_nonexistent_alert_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/alerts/ALT-DOES-NOT-EXIST")
        app.dependency_overrides.clear()
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


# ─────────────────────────────────────────────────────────────
# PATCH /api/v1/alerts/{alert_id}/status
# ─────────────────────────────────────────────────────────────

class TestUpdateAlertStatus:
    def test_update_status_success(self):
        mock_db = MagicMock()
        record = _mock_alert_record(alert_id="ALT-7001", status=AlertStatus.NEW.value)
        mock_db.query.return_value.filter.return_value.first.return_value = record

        with patch(
            "services.alert_case_service.src.api.v1.alerts.case_manager.update_status",
            return_value=record,
        ), patch(
            "services.alert_case_service.src.api.v1.alerts.log_audit_event"
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.patch(
                "/api/v1/alerts/ALT-7001/status",
                json={"status": "UNDER_REVIEW"},
            )
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert response.json()["alert_id"] == "ALT-7001"

    def test_update_status_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch(
            "services.alert_case_service.src.api.v1.alerts.case_manager.update_status",
            return_value=None,
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.patch(
                "/api/v1/alerts/ALT-MISSING/status",
                json={"status": "CLOSED"},
            )
            app.dependency_overrides.clear()

        assert response.status_code == 404

    def test_update_status_invalid_value_returns_422(self):
        response = client.patch(
            "/api/v1/alerts/ALT-7001/status",
            json={"status": "INVALID_STATUS"},
        )
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────
# PATCH /api/v1/alerts/{alert_id}/assign
# ─────────────────────────────────────────────────────────────

class TestAssignAlert:
    def test_assign_success(self):
        mock_db = MagicMock()
        record = _mock_alert_record(alert_id="ALT-7001", assigned_to="ANALYST-05")
        mock_db.query.return_value.filter.return_value.first.return_value = record

        with patch(
            "services.alert_case_service.src.api.v1.alerts.case_manager.assign_alert",
            return_value=record,
        ), patch(
            "services.alert_case_service.src.api.v1.alerts.log_audit_event"
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.patch(
                "/api/v1/alerts/ALT-7001/assign",
                json={"analyst_id": "ANALYST-05"},
            )
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert response.json()["alert_id"] == "ALT-7001"

    def test_assign_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch(
            "services.alert_case_service.src.api.v1.alerts.case_manager.assign_alert",
            return_value=None,
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.patch(
                "/api/v1/alerts/ALT-NONE/assign",
                json={"analyst_id": "ANALYST-01"},
            )
            app.dependency_overrides.clear()

        assert response.status_code == 404

    def test_assign_missing_analyst_id_returns_422(self):
        response = client.patch("/api/v1/alerts/ALT-7001/assign", json={})
        assert response.status_code == 422
