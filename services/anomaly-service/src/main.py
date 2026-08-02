import uvicorn
from fastapi import FastAPI
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from services.anomaly-service.src.config import settings
from services.anomaly-service.src.predictor import predictor, FeatureVector, AnomalyPrediction

logger = setup_logger("anomaly-service")
app = FastAPI(title="TradeGuard ML Anomaly Detection Service")

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="anomaly-service")

@app.post("/api/v1/predict", response_model=AnomalyPrediction)
def predict_anomaly(features: FeatureVector):
    return predictor.predict(features)

if __name__ == "__main__":
    uvicorn.run("services.anomaly-service.src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
