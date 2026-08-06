import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from shared.event_contracts import TradeEvent
from .config import settings
from .consumer import consumer

logger = setup_logger("risk-engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("risk-engine ready.")
    yield
    logger.info("risk-engine shutting down.")


app = FastAPI(title="TradeGuard Risk Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="risk-engine")


@app.post("/api/v1/evaluate")
def evaluate_trade_event(event: TradeEvent):
    """
    Synchronous evaluation endpoint called by the ingestion service.
    Fetches ML anomaly score, applies risk rules, and forwards any alert to the alert-case-service.
    """
    result = consumer.process_event(event)
    if result:
        return {"status": "alert_generated", "alert": result}
    return {"status": "no_alert", "event_id": event.event_id}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
