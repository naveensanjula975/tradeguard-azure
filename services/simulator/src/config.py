import os


class SimulatorSettings:
    INGESTION_SERVICE_URL: str = os.getenv("INGESTION_SERVICE_URL", "http://localhost:8001")
    PORT: int = int(os.getenv("PORT", "8004"))
    HOST: str = os.getenv("HOST", "0.0.0.0")


settings = SimulatorSettings()
