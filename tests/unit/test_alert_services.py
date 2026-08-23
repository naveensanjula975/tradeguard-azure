"""
Unit tests for AlertProcessor and CaseManager services.
Uses SQLAlchemy in-memory SQLite to avoid any real DB dependency.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.schemas.common import AlertSeverity, AlertStatus
from shared.event_contracts import AlertEvent
from services.alert_case_service.src.services.alert_processor import AlertProcessor
from services.alert_case_service.src.services.case_manager import CaseManager


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def sample_alert_event():
    return AlertEvent(
        alert_id="ALT-AABBCC",
        event_id="018f4df8-a82d-7d40-9152-e6a6a8fc3581",
        trader_id="TRD-1001",
        rule_code="LARGE_ORDER",
        title="Large Order Detection",
        description="Order value $150,000.00 exceeds threshold $100,000.00",
        rule_score=75.0,
        anomaly_score=10.0,
        final_risk_score=55.5,
        severity=AlertSeverity.MEDIUM,
        detected_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_db():
    """Returns a Mock SQLAlchemy Session."""
    db = MagicMock()
    return db


@pytest.fixture
def mock_alert_record(sample_alert_event):
    """Returns a mock AlertRecord resembling a DB row."""
    record = MagicMock()
    record.alert_id = sample_alert_event.alert_id
    record.trader_id = sample_alert_event.trader_id
    record.rule_code = sample_alert_event.rule_code
    record.severity = sample_alert_event.severity.value
    record.status = AlertStatus.NEW.value
    record.id = 1
    return record


# ─────────────────────────────────────────────────────────────
# AlertProcessor tests
# ─────────────────────────────────────────────────────────────

class TestAlertProcessor:
    def test_persists_new_alert(self, sample_alert_event, mock_db):
        """New alerts should be added to DB and returned."""
        processor = AlertProcessor()
        # No existing record
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.refresh.side_effect = lambda r: setattr(r, "id", 1)

        result = processor.process_incoming_alert(sample_alert_event, mock_db)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    def test_skips_duplicate_alert(self, sample_alert_event, mock_db, mock_alert_record):
        """Duplicate alert_id should skip insertion and return existing record."""
        processor = AlertProcessor()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_alert_record

        result = processor.process_incoming_alert(sample_alert_event, mock_db)

        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()
        assert result is mock_alert_record

    def test_new_record_has_correct_fields(self, sample_alert_event, mock_db):
        """Verify that the created AlertRecord is populated with correct field values."""
        processor = AlertProcessor()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        captured_records = []
        def capture_add(record):
            captured_records.append(record)
        mock_db.add.side_effect = capture_add

        processor.process_incoming_alert(sample_alert_event, mock_db)

        assert len(captured_records) == 1
        record = captured_records[0]
        assert record.alert_id == sample_alert_event.alert_id
        assert record.trader_id == sample_alert_event.trader_id
        assert record.rule_code == sample_alert_event.rule_code
        assert record.rule_score == sample_alert_event.rule_score
        assert record.anomaly_score == sample_alert_event.anomaly_score
        assert record.final_risk_score == sample_alert_event.final_risk_score
        assert record.severity == sample_alert_event.severity.value
        assert record.status == AlertStatus.NEW.value

    def test_new_record_status_is_new(self, sample_alert_event, mock_db):
        """Status on creation must always be AlertStatus.NEW regardless of input."""
        processor = AlertProcessor()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        captured_records = []
        mock_db.add.side_effect = lambda r: captured_records.append(r)

        processor.process_incoming_alert(sample_alert_event, mock_db)
        assert captured_records[0].status == AlertStatus.NEW.value


# ─────────────────────────────────────────────────────────────
# CaseManager tests
# ─────────────────────────────────────────────────────────────

class TestCaseManager:
    def test_add_note_commits_and_returns_record(self, mock_db):
        """add_note should persist a CaseNoteModel and return it."""
        manager = CaseManager()
        captured = []
        mock_db.add.side_effect = lambda r: captured.append(r)

        result = manager.add_note("ALT-AABBCC", "ANALYST-01", "Suspicious pattern confirmed.", mock_db)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    def test_add_note_stores_correct_fields(self, mock_db):
        manager = CaseManager()
        captured = []
        mock_db.add.side_effect = lambda r: captured.append(r)

        manager.add_note("ALT-XYZ", "ANALYST-02", "Looks legitimate.", mock_db)

        note = captured[0]
        assert note.alert_id == "ALT-XYZ"
        assert note.author_id == "ANALYST-02"
        assert note.note == "Looks legitimate."

    def test_list_notes_returns_ordered_results(self, mock_db):
        """list_notes should query with ordering by created_at."""
        manager = CaseManager()
        mock_notes = [MagicMock(), MagicMock()]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_notes

        result = manager.list_notes("ALT-AABBCC", mock_db)
        assert result == mock_notes

    def test_list_notes_returns_empty_for_unknown_alert(self, mock_db):
        manager = CaseManager()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = manager.list_notes("ALT-UNKNOWN", mock_db)
        assert result == []

    def test_update_status_changes_status(self, mock_db, mock_alert_record):
        """update_status should modify record.status and commit."""
        manager = CaseManager()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_alert_record

        result = manager.update_status("ALT-AABBCC", AlertStatus.UNDER_REVIEW, mock_db)

        assert mock_alert_record.status == AlertStatus.UNDER_REVIEW.value
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        assert result is mock_alert_record

    def test_update_status_returns_none_for_missing_alert(self, mock_db):
        """update_status should gracefully return None if alert not found."""
        manager = CaseManager()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = manager.update_status("ALT-MISSING", AlertStatus.CLOSED, mock_db)
        assert result is None

    def test_assign_alert_sets_analyst(self, mock_db, mock_alert_record):
        """assign_alert should set assigned_to and commit."""
        manager = CaseManager()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_alert_record

        result = manager.assign_alert("ALT-AABBCC", "ANALYST-05", mock_db)

        assert mock_alert_record.assigned_to == "ANALYST-05"
        mock_db.commit.assert_called_once()
        assert result is mock_alert_record

    def test_assign_alert_returns_none_for_missing_alert(self, mock_db):
        manager = CaseManager()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = manager.assign_alert("ALT-NONE", "ANALYST-99", mock_db)
        assert result is None
