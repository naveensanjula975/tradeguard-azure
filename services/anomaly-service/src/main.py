import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from .config import settings
from .predictor import predictor, FeatureVector, AnomalyPrediction

logger = setup_logger("anomaly-service")
app = FastAPI(title="TradeGuard ML Anomaly Detection Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="anomaly-service")


@app.post("/api/v1/predict", response_model=AnomalyPrediction)
def predict_anomaly(features: FeatureVector):
    """Score a feature vector using the Isolation Forest model (heuristic fallback if model absent)."""
    return predictor.predict(features)


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
