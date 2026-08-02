import uvicorn
from fastapi import FastAPI
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from services.ingestion-service.src.config import settings
from services.ingestion-service.src.api.v1.events import router as events_router

logger = setup_logger("ingestion-service")
app = FastAPI(title="Trade Event Ingestion Service")

app.include_router(events_router)

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="ingestion-service")

if __name__ == "__main__":
    uvicorn.run("services.ingestion-service.src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
