import os

class AlertCaseSettings:
    PORT: int = int(os.getenv("PORT", "8003"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres_password@localhost:5432/tradeguard")

settings = AlertCaseSettings()
