import uvicorn
from fastapi import FastAPI
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from services.alert-case-service.src.config import settings
from services.alert-case-service.src.api.v1.alerts import router as alerts_router
from services.alert-case-service.src.api.v1.notes import router as notes_router
from services.alert-case-service.src.api.v1.rules import router as rules_router
from services.alert-case-service.src.api.v1.dashboard import router as dashboard_router

logger = setup_logger("alert-case-service")
app = FastAPI(title="TradeGuard Alert & Case Management Service")

app.include_router(alerts_router)
app.include_router(notes_router)
app.include_router(rules_router)
app.include_router(dashboard_router)

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="alert-case-service")

if __name__ == "__main__":
    uvicorn.run("services.alert-case-service.src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
