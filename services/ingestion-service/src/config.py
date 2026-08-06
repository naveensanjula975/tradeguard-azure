import os


class IngestionSettings:
    PORT: int = int(os.getenv("PORT", "8001"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    # Azure Event Hubs — used in cloud/production deployment
    EVENT_HUBS_CONNECTION_STRING: str = os.getenv("EVENT_HUBS_CONNECTION_STRING", "")
    EVENT_HUBS_NAME: str = os.getenv("EVENT_HUBS_NAME", "trade-events")
    # Local dev: call risk engine directly
    RISK_ENGINE_URL: str = os.getenv("RISK_ENGINE_URL", "http://localhost:8005")


settings = IngestionSettings()
