"""
Tests for Dashboard API endpoints and shared schemas/enums.

Dashboard:
  - GET /api/v1/dashboard/summary        (structure, zero values, with data)
  - GET /api/v1/dashboard/alert-trends   (by_severity, by_rule)
  - GET /api/v1/dashboard/high-risk-traders (ranking, empty)
  - GET /api/v1/dashboard/recent-alerts  (limit param, empty)

Shared Schemas & Enums:
  - AlertSeverity, AlertStatus, EventType, OrderSide, OrderType membership
  - AlertEvent Pydantic validation (scores range, default status)
  - HealthResponse defaults
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from services.alert_case_service.src.main import app
from shared.database.connection import get_db
from shared.schemas.common import (
    AlertSeverity, AlertStatus, EventType, OrderSide, OrderType, HealthResponse
)
from shared.event_contracts import AlertEvent


client = TestClient(app)


# ─────────────────────────────────────────────────────────────
# Dashboard — GET /api/v1/dashboard/summary
# ─────────────────────────────────────────────────────────────

class TestDashboardSummary:
    def _mock_summary_db(
        self,
        total_open=0,
        critical=0,
        confirmed=0,
        high_risk_traders=0,
        events_processed=0,
    ):
        mock_db = MagicMock()
        # Each scalar() call returns a different value depending on the query chain
        scalars = iter([total_open, critical, confirmed, events_processed])
        mock_db.query.return_value.filter.return_value.scalar.side_effect = lambda: next(
            scalars, 0
        )
        mock_db.query.return_value.filter.return_value.filter.return_value.scalar.return_value = critical
        mock_db.query.return_value.scalar.return_value = events_processed
        # high_risk_traders uses .distinct().all()
        mock_db.query.return_value.filter.return_value.filter.return_value.distinct.return_value.all.return_value = [
            MagicMock()
        ] * high_risk_traders
        return mock_db

    def test_summary_returns_200(self):
        mock_db = self._mock_summary_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/dashboard/summary")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_summary_response_has_required_keys(self):
        mock_db = self._mock_summary_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/summary").json()
        app.dependency_overrides.clear()
        for key in [
            "events_processed_today",
            "total_open_alerts",
            "critical_alerts",
            "high_risk_traders",
            "confirmed_incidents",
            "average_processing_time_ms",
        ]:
            assert key in data, f"Missing key: {key}"

    def test_summary_average_processing_time_is_constant(self):
        """The stub always returns 42.5 ms processing time."""
        mock_db = self._mock_summary_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/summary").json()
        app.dependency_overrides.clear()
        assert data["average_processing_time_ms"] == 42.5

    def test_summary_values_are_numeric(self):
        mock_db = self._mock_summary_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/summary").json()
        app.dependency_overrides.clear()
        for key in ["events_processed_today", "total_open_alerts", "critical_alerts",
                    "high_risk_traders", "confirmed_incidents"]:
            assert isinstance(data[key], (int, float)), f"{key} is not numeric"


# ─────────────────────────────────────────────────────────────
# Dashboard — GET /api/v1/dashboard/alert-trends
# ─────────────────────────────────────────────────────────────

class TestDashboardAlertTrends:
    def test_alert_trends_returns_200(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/dashboard/alert-trends")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_alert_trends_response_has_by_severity_and_by_rule(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/alert-trends").json()
        app.dependency_overrides.clear()
        assert "by_severity" in data
        assert "by_rule" in data

    def test_alert_trends_aggregates_by_severity(self):
        mock_db = MagicMock()
        severity_rows = [("HIGH", 3), ("CRITICAL", 1)]
        mock_db.query.return_value.filter.return_value.group_by.return_value.all.return_value = severity_rows
        mock_db.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/alert-trends").json()
        app.dependency_overrides.clear()
        assert data["by_severity"].get("HIGH") == 3
        assert data["by_severity"].get("CRITICAL") == 1

    def test_alert_trends_aggregates_by_rule(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []
        rule_rows = [("LARGE_ORDER", 5), ("WASH_TRADING", 2)]
        mock_db.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = rule_rows
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/alert-trends").json()
        app.dependency_overrides.clear()
        assert data["by_rule"].get("LARGE_ORDER") == 5


# ─────────────────────────────────────────────────────────────
# Dashboard — GET /api/v1/dashboard/high-risk-traders
# ─────────────────────────────────────────────────────────────

class TestDashboardHighRiskTraders:
    def test_high_risk_traders_returns_200(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/dashboard/high-risk-traders")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_high_risk_traders_empty_list(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/high-risk-traders").json()
        app.dependency_overrides.clear()
        assert data == []

    def test_high_risk_traders_response_fields(self):
        mock_db = MagicMock()
        row = MagicMock()
        row.trader_id = "TRD-1042"
        row.max_risk_score = 91.45
        row.open_alert_count = 3
        mock_db.query.return_value.filter.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = [row]
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/high-risk-traders").json()
        app.dependency_overrides.clear()
        assert len(data) == 1
        assert data[0]["trader_id"] == "TRD-1042"
        assert data[0]["risk_score"] == round(91.45, 1)
        assert data[0]["open_alerts"] == 3


# ─────────────────────────────────────────────────────────────
# Dashboard — GET /api/v1/dashboard/recent-alerts
# ─────────────────────────────────────────────────────────────

class TestDashboardRecentAlerts:
    def test_recent_alerts_returns_200(self):
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/dashboard/recent-alerts")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_recent_alerts_empty_list(self):
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/recent-alerts").json()
        app.dependency_overrides.clear()
        assert data == []

    def test_recent_alerts_with_data(self):
        record = MagicMock()
        record.to_dict.return_value = {"alert_id": "ALT-7001", "severity": "HIGH"}
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.limit.return_value.all.return_value = [record]
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/dashboard/recent-alerts").json()
        app.dependency_overrides.clear()
        assert len(data) == 1
        assert data[0]["alert_id"] == "ALT-7001"

    def test_recent_alerts_custom_limit(self):
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.limit.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        # Just verifying it doesn't error out with a valid limit param
        response = client.get("/api/v1/dashboard/recent-alerts?limit=5")
        app.dependency_overrides.clear()
        assert response.status_code == 200


# ─────────────────────────────────────────────────────────────
# Shared schemas — enum membership and values
# ─────────────────────────────────────────────────────────────

class TestSharedEnums:
    def test_alert_severity_members(self):
        members = {s.value for s in AlertSeverity}
        assert members == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    def test_alert_status_members(self):
        members = {s.value for s in AlertStatus}
        assert members == {"NEW", "UNDER_REVIEW", "ESCALATED", "CONFIRMED", "FALSE_POSITIVE", "CLOSED"}

    def test_event_type_members(self):
        members = {e.value for e in EventType}
        assert members == {"ORDER_CREATED", "ORDER_CANCELLED", "ORDER_EXECUTED"}

    def test_order_side_members(self):
        assert set(s.value for s in OrderSide) == {"BUY", "SELL"}

    def test_order_type_members(self):
        assert set(t.value for t in OrderType) == {"LIMIT", "MARKET", "STOP"}

    def test_enum_string_comparison(self):
        """Enums are str subclasses — can compare directly to strings."""
        assert AlertSeverity.HIGH == "HIGH"
        assert AlertStatus.NEW == "NEW"
        assert EventType.ORDER_CREATED == "ORDER_CREATED"


# ─────────────────────────────────────────────────────────────
# AlertEvent Pydantic model validation
# ─────────────────────────────────────────────────────────────

class TestAlertEventModel:
    def _valid_alert(self, **overrides):
        defaults = dict(
            alert_id="ALT-AABBCC",
            event_id="EVT-001",
            trader_id="TRD-1001",
            rule_code="LARGE_ORDER",
            title="Test Alert",
            description="desc",
            rule_score=75.0,
            anomaly_score=10.0,
            final_risk_score=55.5,
            severity=AlertSeverity.HIGH,
            detected_at=datetime.now(timezone.utc),
        )
        defaults.update(overrides)
        return AlertEvent(**defaults)

    def test_valid_alert_creates_successfully(self):
        alert = self._valid_alert()
        assert alert.alert_id == "ALT-AABBCC"

    def test_default_status_is_new(self):
        alert = self._valid_alert()
        assert alert.status == AlertStatus.NEW

    def test_rule_score_above_100_rejected(self):
        with pytest.raises(Exception):
            self._valid_alert(rule_score=101.0)

    def test_rule_score_below_0_rejected(self):
        with pytest.raises(Exception):
            self._valid_alert(rule_score=-1.0)

    def test_anomaly_score_above_100_rejected(self):
        with pytest.raises(Exception):
            self._valid_alert(anomaly_score=100.1)

    def test_final_risk_score_above_100_rejected(self):
        with pytest.raises(Exception):
            self._valid_alert(final_risk_score=101.0)

    def test_description_is_optional(self):
        alert = self._valid_alert(description=None)
        assert alert.description is None

    def test_invalid_severity_rejected(self):
        with pytest.raises(Exception):
            self._valid_alert(severity="ULTRA")


# ─────────────────────────────────────────────────────────────
# HealthResponse
# ─────────────────────────────────────────────────────────────

class TestHealthResponse:
    def test_default_status_is_healthy(self):
        h = HealthResponse(service="test-service")
        assert h.status == "healthy"

    def test_default_version(self):
        h = HealthResponse(service="test-service")
        assert h.version == "0.1.0"

    def test_custom_service_name(self):
        h = HealthResponse(service="my-svc")
        assert h.service == "my-svc"

    def test_status_can_be_overridden(self):
        h = HealthResponse(service="svc", status="degraded")
        assert h.status == "degraded"
