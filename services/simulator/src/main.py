import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from services.simulator.src.config import settings
from services.simulator.src.generator import generate_random_trade_event

logger = setup_logger("simulator-service")
app = FastAPI(title="Trade Simulator Service")

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
    events = [generate_random_trade_event(req.scenario) for _ in range(req.count)]
    logger.info(f"Generated {len(events)} events for scenario: {req.scenario}")
    return {"status": "generated", "events": [e.model_dump() for e in events]}

if __name__ == "__main__":
    uvicorn.run("services.simulator.src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
