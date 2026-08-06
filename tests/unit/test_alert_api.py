import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from services.alert_case_service.src.main import app
from shared.database.connection import get_db

client = TestClient(app)

def test_alert_case_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "alert-case-service"

def test_list_alerts_empty():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
    
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get("/api/v1/alerts")
    
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []

def test_get_alert_not_found():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get("/api/v1/alerts/ALT-NONEXISTENT")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]
