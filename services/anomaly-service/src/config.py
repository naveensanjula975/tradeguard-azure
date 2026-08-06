import os


class AnomalySettings:
    PORT: int = int(os.getenv("PORT", "8002"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    MODEL_PATH: str = os.getenv("MODEL_PATH", "ml/models/isolation_forest_v1.joblib")


settings = AnomalySettings()
