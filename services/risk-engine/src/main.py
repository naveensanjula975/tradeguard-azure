import uvicorn
from fastapi import FastAPI
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from services.risk-engine.src.config import settings

logger = setup_logger("risk-engine")
app = FastAPI(title="TradeGuard Risk Engine")

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="risk-engine")

if __name__ == "__main__":
    uvicorn.run("services.risk-engine.src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
