import os
import joblib
from pydantic import BaseModel, Field
from shared.observability import setup_logger
from services.anomaly-service.src.config import settings

logger = setup_logger("anomaly-predictor")

class FeatureVector(BaseModel):
    order_value: float
    orders_per_minute: float
    cancellation_rate: float
    volume_ratio: float
    instruments_traded: int
    hour_of_activity: int
    is_new_device: int

class AnomalyPrediction(BaseModel):
    is_anomaly: bool
    anomaly_score: float = Field(..., ge=0, le=100)
    model_version: str = Field(default="isolation-forest-v1")

class AnomalyPredictor:
    def __init__(self):
        self.model = None
        self.version = "isolation-forest-v1"
        self._load_model()

    def _load_model(self):
        if os.path.exists(settings.MODEL_PATH):
            try:
                self.model = joblib.load(settings.MODEL_PATH)
                logger.info(f"Successfully loaded ML model from {settings.MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load ML model from {settings.MODEL_PATH}: {e}")
        else:
            logger.warning(f"ML model file not found at {settings.MODEL_PATH}. Using fallback heuristic predictor.")

    def predict(self, features: FeatureVector) -> AnomalyPrediction:
        if self.model:
            # Predict using loaded Isolation Forest model
            score_raw = float(self.model.decision_function([[
                features.order_value,
                features.orders_per_minute,
                features.cancellation_rate,
                features.volume_ratio,
                features.instruments_traded,
                features.hour_of_activity,
                features.is_new_device
            ]])[0])
            # Map raw decision function to 0-100 anomaly score
            anomaly_score = min(100.0, max(0.0, (0.5 - score_raw) * 100))
            is_anomaly = anomaly_score >= 60.0
        else:
            # Fallback heuristic calculation
            score = 10.0
            if features.order_value > 50000:
                score += 30.0
            if features.is_new_device:
                score += 35.0
            if features.cancellation_rate > 0.5:
                score += 20.0
            anomaly_score = min(100.0, score)
            is_anomaly = anomaly_score >= 60.0

        return AnomalyPrediction(
            is_anomaly=is_anomaly,
            anomaly_score=round(anomaly_score, 1),
            model_version=self.version
        )

predictor = AnomalyPredictor()
