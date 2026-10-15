"""
Unit and API integration tests for the Anomaly Detection Service (services/anomaly-service).

Covers:
  1. FeatureVector and AnomalyPrediction Pydantic schema validation
  2. AnomalyPredictor heuristic fallback scoring (when model is absent/corrupt)
  3. AnomalyPredictor ML inference using Isolation Forest decision function
  4. Model loading resilience and error handling
  5. FastAPI endpoints: GET /health and POST /api/v1/predict
"""
import os
import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError
from fastapi.testclient import TestClient

from services.anomaly_service.src.predictor import (
    AnomalyPredictor,
    AnomalyPrediction,
    FeatureVector,
)
from services.anomaly_service.src.main import app


# ─────────────────────────────────────────────────────────────
# Fixtures & Helpers
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def baseline_features():
    """Returns a baseline normal feature vector."""
    return FeatureVector(
        order_value=5000.0,
        orders_per_minute=2.0,
        cancellation_rate=0.05,
        volume_ratio=1.0,
        instruments_traded=2,
        hour_of_activity=14,
        is_new_device=0,
    )


@pytest.fixture
def anomaly_features():
    """Returns a feature vector that triggers heuristic anomaly detection."""
    return FeatureVector(
        order_value=85000.0,
        orders_per_minute=25.0,
        cancellation_rate=0.65,
        volume_ratio=4.5,
        instruments_traded=8,
        hour_of_activity=3,
        is_new_device=1,
    )


@pytest.fixture
def client():
    return TestClient(app)


# ─────────────────────────────────────────────────────────────
# 1. Pydantic Schemas & FeatureVector Validation
# ─────────────────────────────────────────────────────────────

class TestFeatureVectorValidation:
    """Test schema validation and constraints on FeatureVector."""

    def test_valid_feature_vector(self, baseline_features):
        assert baseline_features.order_value == 5000.0
        assert baseline_features.orders_per_minute == 2.0
        assert baseline_features.cancellation_rate == 0.05
        assert baseline_features.volume_ratio == 1.0
        assert baseline_features.instruments_traded == 2
        assert baseline_features.hour_of_activity == 14
        assert baseline_features.is_new_device == 0

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            FeatureVector(
                # order_value is missing
                orders_per_minute=1.0,
                cancellation_rate=0.0,
                volume_ratio=1.0,
                instruments_traded=1,
                hour_of_activity=10,
                is_new_device=0,
            )

    def test_invalid_type_raises(self):
        with pytest.raises(ValidationError):
            FeatureVector(
                order_value="not-a-number",
                orders_per_minute=1.0,
                cancellation_rate=0.0,
                volume_ratio=1.0,
                instruments_traded=1,
                hour_of_activity=10,
                is_new_device=0,
            )

    def test_type_coercion_for_compatible_types(self):
        # integers can coerce to floats in pydantic
        features = FeatureVector(
            order_value=1000,
            orders_per_minute=5,
            cancellation_rate=0,
            volume_ratio=2,
            instruments_traded=3,
            hour_of_activity=12,
            is_new_device=1,
        )
        assert isinstance(features.order_value, float)
        assert features.order_value == 1000.0


class TestAnomalyPredictionSchema:
    """Test constraints on AnomalyPrediction response schema."""

    def test_valid_prediction_model(self):
        pred = AnomalyPrediction(
            is_anomaly=True,
            anomaly_score=78.5,
            model_version="isolation-forest-v1",
        )
        assert pred.is_anomaly is True
        assert pred.anomaly_score == 78.5
        assert pred.model_version == "isolation-forest-v1"

    def test_default_model_version(self):
        pred = AnomalyPrediction(
            is_anomaly=False,
            anomaly_score=10.0,
        )
        assert pred.model_version == "isolation-forest-v1"

    def test_anomaly_score_bounds_enforced(self):
        # ge=0, le=100
        with pytest.raises(ValidationError):
            AnomalyPrediction(is_anomaly=False, anomaly_score=-0.1)

        with pytest.raises(ValidationError):
            AnomalyPrediction(is_anomaly=True, anomaly_score=100.1)


# ─────────────────────────────────────────────────────────────
# 2. Heuristic Fallback Tests (Model Absent)
# ─────────────────────────────────────────────────────────────

class TestAnomalyPredictorHeuristic:
    """Tests when no ML model file is present and heuristic fallback is used."""

    def test_baseline_low_risk(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        result = predictor.predict(baseline_features)
        assert result.is_anomaly is False
        assert result.anomaly_score == 10.0
        assert result.model_version == "isolation-forest-v1"

    def test_order_value_above_threshold_adds_score(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.order_value = 50000.01  # > 50000 adds +30
        result = predictor.predict(baseline_features)
        # baseline (10) + order_value (30) = 40.0 (< 60 => is_anomaly=False)
        assert result.anomaly_score == 40.0
        assert result.is_anomaly is False

    def test_order_value_at_or_below_threshold_no_bonus(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.order_value = 50000.00
        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 10.0
        assert result.is_anomaly is False

    def test_new_device_adds_score(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.is_new_device = 1  # adds +35
        result = predictor.predict(baseline_features)
        # baseline (10) + new_device (35) = 45.0 (< 60 => is_anomaly=False)
        assert result.anomaly_score == 45.0
        assert result.is_anomaly is False

    def test_high_cancellation_rate_adds_score(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.cancellation_rate = 0.51  # > 0.5 adds +20
        result = predictor.predict(baseline_features)
        # baseline (10) + cancellation (20) = 30.0 (< 60 => is_anomaly=False)
        assert result.anomaly_score == 30.0
        assert result.is_anomaly is False

    def test_cancellation_rate_exact_threshold_no_bonus(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.cancellation_rate = 0.50
        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 10.0

    def test_combined_high_value_and_new_device_triggers_anomaly(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.order_value = 60000.0  # +30
        baseline_features.is_new_device = 1      # +35
        result = predictor.predict(baseline_features)
        # baseline (10) + 30 + 35 = 75.0 (>= 60 => is_anomaly=True)
        assert result.anomaly_score == 75.0
        assert result.is_anomaly is True

    def test_combined_exact_threshold_60_triggers_anomaly(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.order_value = 60000.0      # +30
        baseline_features.cancellation_rate = 0.6    # +20
        # baseline (10) + 30 + 20 = 60.0 (>= 60 => is_anomaly=True)
        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 60.0
        assert result.is_anomaly is True

    def test_all_triggers_combined(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        baseline_features.order_value = 100000.0     # +30
        baseline_features.is_new_device = 1          # +35
        baseline_features.cancellation_rate = 0.8    # +20
        # baseline (10) + 30 + 35 + 20 = 95.0
        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 95.0
        assert result.is_anomaly is True

    def test_heuristic_score_capped_at_100(self, baseline_features):
        predictor = AnomalyPredictor()
        predictor.model = None

        # Verify min(100.0, score) constraint
        baseline_features.order_value = 100000.0
        baseline_features.is_new_device = 1
        baseline_features.cancellation_rate = 0.9
        result = predictor.predict(baseline_features)
        assert result.anomaly_score <= 100.0


# ─────────────────────────────────────────────────────────────
# 3. Model Loading & Error Handling
# ─────────────────────────────────────────────────────────────

class TestAnomalyPredictorModelLoading:
    """Test model loading logic and fallback behavior."""

    def test_model_not_found_falls_back_gracefully(self):
        with patch("os.path.exists", return_value=False):
            predictor = AnomalyPredictor()
            assert predictor.model is None

    def test_model_loading_success(self):
        mock_model = MagicMock()
        with patch("os.path.exists", return_value=True), \
             patch("joblib.load", return_value=mock_model):
            predictor = AnomalyPredictor()
            assert predictor.model is mock_model

    def test_model_loading_exception_falls_back_to_none(self):
        with patch("os.path.exists", return_value=True), \
             patch("joblib.load", side_effect=Exception("Corrupted model file")):
            predictor = AnomalyPredictor()
            assert predictor.model is None


# ─────────────────────────────────────────────────────────────
# 4. ML Inference (Model Present)
# ─────────────────────────────────────────────────────────────

class TestAnomalyPredictorMLInference:
    """Tests when ML Isolation Forest model is loaded and decision_function is used."""

    def test_ml_prediction_normal_sample(self, baseline_features):
        mock_model = MagicMock()
        # High decision function value represents a very normal/inlier point
        # e.g., score_raw = 0.4 => anomaly_score = (0.5 - 0.4) * 100 = 10.0
        mock_model.decision_function.return_value = [0.4]

        predictor = AnomalyPredictor()
        predictor.model = mock_model

        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 10.0
        assert result.is_anomaly is False

        # Verify correct features were passed in 2D array
        mock_model.decision_function.assert_called_once_with([[
            baseline_features.order_value,
            baseline_features.orders_per_minute,
            baseline_features.cancellation_rate,
            baseline_features.volume_ratio,
            baseline_features.instruments_traded,
            baseline_features.hour_of_activity,
            baseline_features.is_new_device,
        ]])

    def test_ml_prediction_anomalous_sample(self, baseline_features):
        mock_model = MagicMock()
        # Negative decision function value represents an outlier/anomaly
        # e.g., score_raw = -0.2 => anomaly_score = (0.5 - (-0.2)) * 100 = 70.0
        mock_model.decision_function.return_value = [-0.2]

        predictor = AnomalyPredictor()
        predictor.model = mock_model

        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 70.0
        assert result.is_anomaly is True

    def test_ml_prediction_exact_threshold(self, baseline_features):
        mock_model = MagicMock()
        # score_raw = -0.1 => anomaly_score = (0.5 - (-0.1)) * 100 = 60.0
        mock_model.decision_function.return_value = [-0.1]

        predictor = AnomalyPredictor()
        predictor.model = mock_model

        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 60.0
        assert result.is_anomaly is True

    def test_ml_prediction_clamped_to_100_for_extreme_outlier(self, baseline_features):
        mock_model = MagicMock()
        # score_raw = -1.5 => (0.5 - (-1.5)) * 100 = 200 => clamped to 100.0
        mock_model.decision_function.return_value = [-1.5]

        predictor = AnomalyPredictor()
        predictor.model = mock_model

        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 100.0
        assert result.is_anomaly is True

    def test_ml_prediction_clamped_to_zero_for_extreme_inlier(self, baseline_features):
        mock_model = MagicMock()
        # score_raw = 1.5 => (0.5 - 1.5) * 100 = -100 => clamped to 0.0
        mock_model.decision_function.return_value = [1.5]

        predictor = AnomalyPredictor()
        predictor.model = mock_model

        result = predictor.predict(baseline_features)
        assert result.anomaly_score == 0.0
        assert result.is_anomaly is False


# ─────────────────────────────────────────────────────────────
# 5. FastAPI Endpoints Integration
# ─────────────────────────────────────────────────────────────

class TestAnomalyServiceEndpoints:
    """Test FastAPI /health and /api/v1/predict endpoints."""

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "anomaly-service"

    def test_predict_endpoint_valid_low_risk(self, client, baseline_features):
        with patch("services.anomaly_service.src.main.predictor.model", None):
            response = client.post(
                "/api/v1/predict",
                json=baseline_features.model_dump(),
            )
            assert response.status_code == 200
            data = response.json()
            assert data["is_anomaly"] is False
            assert data["anomaly_score"] == 10.0
            assert data["model_version"] == "isolation-forest-v1"

    def test_predict_endpoint_valid_anomaly(self, client, anomaly_features):
        with patch("services.anomaly_service.src.main.predictor.model", None):
            response = client.post(
                "/api/v1/predict",
                json=anomaly_features.model_dump(),
            )
            assert response.status_code == 200
            data = response.json()
            assert data["is_anomaly"] is True
            assert data["anomaly_score"] >= 60.0
            assert data["model_version"] == "isolation-forest-v1"

    def test_predict_endpoint_missing_field_returns_422(self, client):
        payload = {
            "order_value": 1000.0,
            # orders_per_minute missing
            "cancellation_rate": 0.1,
            "volume_ratio": 1.0,
            "instruments_traded": 1,
            "hour_of_activity": 12,
            "is_new_device": 0,
        }
        response = client.post("/api/v1/predict", json=payload)
        assert response.status_code == 422
        errors = response.json().get("detail", [])
        assert any("orders_per_minute" in str(err) for err in errors)

    def test_predict_endpoint_invalid_type_returns_422(self, client):
        payload = {
            "order_value": "invalid-string",
            "orders_per_minute": 1.0,
            "cancellation_rate": 0.1,
            "volume_ratio": 1.0,
            "instruments_traded": 1,
            "hour_of_activity": 12,
            "is_new_device": 0,
        }
        response = client.post("/api/v1/predict", json=payload)
        assert response.status_code == 422

    def test_predict_endpoint_empty_body_returns_422(self, client):
        response = client.post("/api/v1/predict", json={})
        assert response.status_code == 422
