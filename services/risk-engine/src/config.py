import os

class RiskEngineSettings:
    PORT: int = int(os.getenv("PORT", "8005"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    ANOMALY_SERVICE_URL: str = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8002")
    SERVICE_BUS_CONNECTION_STRING: str = os.getenv("SERVICE_BUS_CONNECTION_STRING", "")
    SERVICE_BUS_QUEUE_NAME: str = os.getenv("SERVICE_BUS_QUEUE_NAME", "alerts-queue")

settings = RiskEngineSettings()
