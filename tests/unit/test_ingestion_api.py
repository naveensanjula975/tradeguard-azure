import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from services.ingestion_service.src.main import app
from shared.database.connection import get_db

client = TestClient(app)

@pytest.fixture
def mock_db_session():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    return mock_db

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ingestion-service"

@patch("services.ingestion_service.src.api.v1.events.publisher")
def test_receive_trade_event_success(mock_publisher, sample_trade_event):
    mock_publisher.publish_trade_event.return_value = True

    # Override get_db dependency
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    app.dependency_overrides[get_db] = lambda: mock_db

    payload = sample_trade_event.model_dump(mode="json")
    response = client.post("/api/v1/trade-events", json=payload)
    
    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "accepted"
    assert data["event_id"] == sample_trade_event.event_id

def test_receive_duplicate_trade_event(sample_trade_event):
    mock_db = MagicMock()
    mock_existing = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_existing
    app.dependency_overrides[get_db] = lambda: mock_db

    payload = sample_trade_event.model_dump(mode="json")
    response = client.post("/api/v1/trade-events", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "Duplicate event_id" in response.json()["detail"]
