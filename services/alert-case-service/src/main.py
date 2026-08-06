import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from shared.database.connection import engine
from shared.database.models import Base
from .config import settings
from .api.v1.alerts import router as alerts_router
from .api.v1.notes import router as notes_router
from .api.v1.rules import router as rules_router
from .api.v1.dashboard import router as dashboard_router

logger = setup_logger("alert-case-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables if not present...")
    Base.metadata.create_all(bind=engine)
    logger.info("alert-case-service ready.")
    yield
    logger.info("alert-case-service shutting down.")


app = FastAPI(title="TradeGuard Alert & Case Management Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts_router)
app.include_router(notes_router)
app.include_router(rules_router)
app.include_router(dashboard_router)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="alert-case-service")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
