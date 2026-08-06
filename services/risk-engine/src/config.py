import os


class RiskEngineSettings:
    PORT: int = int(os.getenv("PORT", "8005"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ANOMALY_SERVICE_URL: str = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8002")
    ALERT_CASE_SERVICE_URL: str = os.getenv("ALERT_CASE_SERVICE_URL", "http://localhost:8003")
    # Azure Service Bus — used in cloud deployment only
    SERVICE_BUS_CONNECTION_STRING: str = os.getenv("SERVICE_BUS_CONNECTION_STRING", "")
    SERVICE_BUS_QUEUE_NAME: str = os.getenv("SERVICE_BUS_QUEUE_NAME", "alerts-queue")


settings = RiskEngineSettings()
