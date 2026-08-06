import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from .config import settings
from .generator import generate_random_trade_event

logger = setup_logger("simulator-service")
app = FastAPI(title="Trade Simulator Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScenarioRequest(BaseModel):
    scenario: str = "normal"
    count: int = 1


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="simulator")


@app.post("/api/v1/simulation/start")
def start_simulation():
    logger.info("Simulation started.")
    return {"status": "started"}


@app.post("/api/v1/simulation/stop")
def stop_simulation():
    logger.info("Simulation stopped.")
    return {"status": "stopped"}


@app.post("/api/v1/simulation/scenario")
def trigger_scenario(req: ScenarioRequest):
    """
    Generates synthetic trade events and forwards them to the ingestion service.
    Scenarios: normal | large_order | new_device_high_value
    """
    if req.count < 1 or req.count > 100:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="count must be 1-100")

    events = [generate_random_trade_event(req.scenario) for _ in range(req.count)]
    logger.info(f"Generated {len(events)} events for scenario '{req.scenario}'")

    results = []
    for event in events:
        try:
            resp = httpx.post(
                f"{settings.INGESTION_SERVICE_URL}/api/v1/trade-events",
                json=event.model_dump(mode="json"),
                timeout=10.0,
            )
            results.append({
                "event_id": event.event_id,
                "ingestion_status": resp.status_code,
                "response": resp.json(),
            })
        except Exception as e:
            logger.error(f"Failed to send event {event.event_id}: {e}")
            results.append({"event_id": event.event_id, "ingestion_status": "error", "response": str(e)})

    return {"scenario": req.scenario, "count": req.count, "results": results}


@app.get("/api/v1/simulation/scenarios")
def list_scenarios():
    return {
        "scenarios": [
            {"code": "normal",                "description": "Random normal-range trade event"},
            {"code": "large_order",           "description": "Order value ≥ $150,000 — triggers Large Order rule"},
            {"code": "new_device_high_value", "description": "New device + $60k order — triggers New Device & High Value rule"},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
