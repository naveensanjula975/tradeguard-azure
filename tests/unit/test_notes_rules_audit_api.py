"""
API integration tests for the Investigation Notes & Risk Rules endpoints:

Notes:
  - GET  /api/v1/alerts/{id}/notes  (list notes, 404 for unknown alert)
  - POST /api/v1/alerts/{id}/notes  (create note, 404 for unknown alert, 422 validation)

Risk Rules:
  - GET   /api/v1/risk-rules         (seed + list all rules)
  - PATCH /api/v1/risk-rules/{code}  (update threshold/enabled, 404 for unknown code, 422)

Audit Logs:
  - GET /api/v1/audit-logs           (empty + filtered, pagination validation)
  - log_audit_event helper           (field persistence unit tests)
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call
from fastapi.testclient import TestClient

from services.alert_case_service.src.main import app
from shared.database.connection import get_db
from shared.schemas.common import AlertStatus


client = TestClient(app)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _mock_alert_record(alert_id="ALT-7001"):
    r = MagicMock()
    r.alert_id = alert_id
    r.to_dict.return_value = {"alert_id": alert_id}
    return r


def _mock_note(alert_id="ALT-7001", author="ANALYST-01", note="Test note"):
    n = MagicMock()
    n.alert_id = alert_id
    n.author_id = author
    n.note = note
    n.created_at = datetime.now(timezone.utc)
    n.to_dict.return_value = {
        "alert_id": alert_id,
        "author_id": author,
        "note": note,
    }
    return n


def _mock_rule(code="LARGE_ORDER", threshold=100000.0, enabled=True):
    r = MagicMock()
    r.id = 1
    r.code = code
    r.name = "Large Order"
    r.description = "desc"
    r.threshold = threshold
    r.severity = "HIGH"
    r.enabled = enabled
    return r


# ─────────────────────────────────────────────────────────────
# GET /api/v1/alerts/{alert_id}/notes
# ─────────────────────────────────────────────────────────────

class TestListNotes:
    def test_list_notes_returns_200_with_empty_list(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = _mock_alert_record()
        with patch(
            "services.alert_case_service.src.api.v1.notes.case_manager.list_notes",
            return_value=[],
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.get("/api/v1/alerts/ALT-7001/notes")
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["alert_id"] == "ALT-7001"
        assert data["notes"] == []

    def test_list_notes_returns_notes_list(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = _mock_alert_record()
        note = _mock_note()
        with patch(
            "services.alert_case_service.src.api.v1.notes.case_manager.list_notes",
            return_value=[note],
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.get("/api/v1/alerts/ALT-7001/notes")
            app.dependency_overrides.clear()

        data = response.json()
        assert len(data["notes"]) == 1

    def test_list_notes_unknown_alert_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/alerts/ALT-MISSING/notes")
        app.dependency_overrides.clear()
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


# ─────────────────────────────────────────────────────────────
# POST /api/v1/alerts/{alert_id}/notes
# ─────────────────────────────────────────────────────────────

class TestCreateNote:
    def test_create_note_returns_201(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = _mock_alert_record()
        note = _mock_note()
        with patch(
            "services.alert_case_service.src.api.v1.notes.case_manager.add_note",
            return_value=note,
        ), patch(
            "services.alert_case_service.src.api.v1.notes.log_audit_event"
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.post(
                "/api/v1/alerts/ALT-7001/notes",
                json={"author_id": "ANALYST-01", "note": "Confirmed suspicious pattern."},
            )
            app.dependency_overrides.clear()

        assert response.status_code == 201

    def test_create_note_missing_author_returns_422(self):
        response = client.post(
            "/api/v1/alerts/ALT-7001/notes",
            json={"note": "Missing author_id field"},
        )
        assert response.status_code == 422

    def test_create_note_missing_note_text_returns_422(self):
        response = client.post(
            "/api/v1/alerts/ALT-7001/notes",
            json={"author_id": "ANALYST-01"},
        )
        assert response.status_code == 422

    def test_create_note_unknown_alert_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.post(
            "/api/v1/alerts/ALT-GHOST/notes",
            json={"author_id": "ANALYST-01", "note": "Does not exist."},
        )
        app.dependency_overrides.clear()
        assert response.status_code == 404

    def test_create_note_triggers_audit_log(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = _mock_alert_record()
        note = _mock_note()
        with patch(
            "services.alert_case_service.src.api.v1.notes.case_manager.add_note",
            return_value=note,
        ) as mock_add, patch(
            "services.alert_case_service.src.api.v1.notes.log_audit_event"
        ) as mock_audit:
            app.dependency_overrides[get_db] = lambda: mock_db
            client.post(
                "/api/v1/alerts/ALT-7001/notes",
                json={"author_id": "ANALYST-01", "note": "Audit trail check."},
            )
            app.dependency_overrides.clear()
        mock_audit.assert_called_once()
        kwargs = mock_audit.call_args.kwargs
        assert kwargs["action"] == "ADD_NOTE"
        assert kwargs["entity_id"] == "ALT-7001"


# ─────────────────────────────────────────────────────────────
# GET /api/v1/risk-rules
# ─────────────────────────────────────────────────────────────

class TestListRiskRules:
    def _setup_seeded_db(self, rules=None):
        mock_db = MagicMock()
        rules = rules or [_mock_rule()]
        # _seed_rules checks count() and adds if 0; return 1 to skip seeding
        mock_db.query.return_value.count.return_value = len(rules)
        mock_db.query.return_value.order_by.return_value.all.return_value = rules
        return mock_db

    def test_list_rules_returns_200(self):
        mock_db = self._setup_seeded_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/risk-rules")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_list_rules_returns_list(self):
        mock_db = self._setup_seeded_db([_mock_rule("LARGE_ORDER"), _mock_rule("WASH_TRADING")])
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/risk-rules").json()
        app.dependency_overrides.clear()
        assert isinstance(data, list)
        assert len(data) == 2

    def test_list_rules_response_has_required_fields(self):
        mock_db = self._setup_seeded_db([_mock_rule()])
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/risk-rules").json()
        app.dependency_overrides.clear()
        rule = data[0]
        for field in ["code", "name", "description", "threshold", "severity", "enabled"]:
            assert field in rule, f"Missing field: {field}"

    def test_list_rules_seeds_if_table_empty(self):
        mock_db = MagicMock()
        mock_db.query.return_value.count.return_value = 0  # empty → should seed
        mock_db.query.return_value.order_by.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        client.get("/api/v1/risk-rules")
        app.dependency_overrides.clear()
        mock_db.add.assert_called()
        mock_db.commit.assert_called()


# ─────────────────────────────────────────────────────────────
# PATCH /api/v1/risk-rules/{rule_code}
# ─────────────────────────────────────────────────────────────

class TestUpdateRiskRule:
    def test_update_rule_success(self):
        mock_db = MagicMock()
        rule = _mock_rule(code="LARGE_ORDER", threshold=100000.0, enabled=True)
        mock_db.query.return_value.filter.return_value.first.return_value = rule
        with patch(
            "services.alert_case_service.src.api.v1.rules.log_audit_event"
        ):
            app.dependency_overrides[get_db] = lambda: mock_db
            response = client.patch(
                "/api/v1/risk-rules/LARGE_ORDER",
                json={"threshold": 200000.0, "enabled": True},
            )
            app.dependency_overrides.clear()
        assert response.status_code == 200
        # threshold should be updated on the mock rule object
        assert rule.threshold == 200000.0

    def test_update_rule_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.patch(
            "/api/v1/risk-rules/NONEXISTENT_CODE",
            json={"threshold": 50.0, "enabled": False},
        )
        app.dependency_overrides.clear()
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_update_rule_missing_enabled_returns_422(self):
        response = client.patch(
            "/api/v1/risk-rules/LARGE_ORDER",
            json={"threshold": 200000.0},  # missing "enabled"
        )
        assert response.status_code == 422

    def test_update_rule_missing_threshold_returns_422(self):
        response = client.patch(
            "/api/v1/risk-rules/LARGE_ORDER",
            json={"enabled": False},  # missing "threshold"
        )
        assert response.status_code == 422

    def test_update_rule_disable_rule(self):
        mock_db = MagicMock()
        rule = _mock_rule(code="WASH_TRADING", enabled=True)
        mock_db.query.return_value.filter.return_value.first.return_value = rule
        with patch("services.alert_case_service.src.api.v1.rules.log_audit_event"):
            app.dependency_overrides[get_db] = lambda: mock_db
            client.patch(
                "/api/v1/risk-rules/WASH_TRADING",
                json={"threshold": 3.0, "enabled": False},
            )
            app.dependency_overrides.clear()
        assert rule.enabled is False

    def test_update_rule_triggers_audit_log(self):
        mock_db = MagicMock()
        rule = _mock_rule(code="PRICE_SPIKE")
        mock_db.query.return_value.filter.return_value.first.return_value = rule
        with patch(
            "services.alert_case_service.src.api.v1.rules.log_audit_event"
        ) as mock_audit:
            app.dependency_overrides[get_db] = lambda: mock_db
            client.patch(
                "/api/v1/risk-rules/PRICE_SPIKE",
                json={"threshold": 20.0, "enabled": True},
            )
            app.dependency_overrides.clear()
        mock_audit.assert_called_once()
        kwargs = mock_audit.call_args.kwargs
        assert kwargs["action"] == "UPDATE_RULE"
        assert kwargs["entity_id"] == "PRICE_SPIKE"
        assert kwargs["entity_type"] == "RISK_RULE"


# ─────────────────────────────────────────────────────────────
# GET /api/v1/audit-logs
# ─────────────────────────────────────────────────────────────

class TestAuditLogs:
    def _setup_audit_db(self, items=None):
        mock_db = MagicMock()
        items = items or []
        mock_db.query.return_value.count.return_value = len(items)
        mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = items
        mock_db.query.return_value.filter.return_value.count.return_value = len(items)
        mock_db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = items
        mock_db.query.return_value.filter.return_value.filter.return_value.count.return_value = len(items)
        mock_db.query.return_value.filter.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = items
        mock_db.query.return_value.filter.return_value.filter.return_value.filter.return_value.count.return_value = len(items)
        mock_db.query.return_value.filter.return_value.filter.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = items
        return mock_db

    def test_audit_logs_returns_200(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/audit-logs")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_audit_logs_empty_structure(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/audit-logs").json()
        app.dependency_overrides.clear()
        assert data["total"] == 0
        assert data["items"] == []
        assert "limit" in data
        assert "offset" in data

    def test_audit_logs_pagination_defaults(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        data = client.get("/api/v1/audit-logs").json()
        app.dependency_overrides.clear()
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_audit_logs_limit_above_200_rejected(self):
        response = client.get("/api/v1/audit-logs?limit=500")
        assert response.status_code == 422

    def test_audit_logs_accepts_filter_by_user_id(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/audit-logs?user_id=ANALYST-01")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_audit_logs_accepts_filter_by_entity_type(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/audit-logs?entity_type=ALERT")
        app.dependency_overrides.clear()
        assert response.status_code == 200

    def test_audit_logs_accepts_filter_by_entity_id(self):
        mock_db = self._setup_audit_db()
        app.dependency_overrides[get_db] = lambda: mock_db
        response = client.get("/api/v1/audit-logs?entity_id=ALT-7001")
        app.dependency_overrides.clear()
        assert response.status_code == 200


# ─────────────────────────────────────────────────────────────
# log_audit_event helper unit test
# ─────────────────────────────────────────────────────────────

class TestLogAuditEvent:
    def test_log_audit_event_persists_entry(self):
        from services.alert_case_service.src.api.v1.audit_logs import log_audit_event
        mock_db = MagicMock()
        captured = []
        mock_db.add.side_effect = lambda entry: captured.append(entry)

        log_audit_event(
            db=mock_db,
            user_id="ANALYST-01",
            entity_type="ALERT",
            entity_id="ALT-7001",
            action="UPDATE_STATUS",
            old_value="NEW",
            new_value="UNDER_REVIEW",
        )

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        entry = captured[0]
        assert entry.user_id == "ANALYST-01"
        assert entry.entity_type == "ALERT"
        assert entry.entity_id == "ALT-7001"
        assert entry.action == "UPDATE_STATUS"
        assert entry.old_value == "NEW"
        assert entry.new_value == "UNDER_REVIEW"

    def test_log_audit_event_without_old_value(self):
        from services.alert_case_service.src.api.v1.audit_logs import log_audit_event
        mock_db = MagicMock()
        captured = []
        mock_db.add.side_effect = lambda e: captured.append(e)

        log_audit_event(
            db=mock_db,
            user_id="SYSTEM",
            entity_type="RISK_RULE",
            entity_id="WASH_TRADING",
            action="CREATE",
            new_value="threshold=3.0",
        )

        entry = captured[0]
        assert entry.old_value is None
        assert entry.new_value == "threshold=3.0"
