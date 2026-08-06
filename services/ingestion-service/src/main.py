import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.schemas import HealthResponse
from shared.observability import setup_logger
from shared.database.connection import engine
from shared.database.models import Base
from .config import settings
from .api.v1.events import router as events_router

logger = setup_logger("ingestion-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables if not present...")
    Base.metadata.create_all(bind=engine)
    logger.info("ingestion-service ready.")
    yield
    logger.info("ingestion-service shutting down.")


app = FastAPI(title="Trade Event Ingestion Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(service="ingestion-service")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
