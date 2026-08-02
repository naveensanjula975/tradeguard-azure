import os

class IngestionSettings:
    PORT: int = int(os.getenv("PORT", "8001"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    EVENT_HUBS_CONNECTION_STRING: str = os.getenv("EVENT_HUBS_CONNECTION_STRING", "")
    EVENT_HUBS_NAME: str = os.getenv("EVENT_HUBS_NAME", "trade-events")

settings = IngestionSettings()
