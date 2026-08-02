import os
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

def train_model(
    dataset_path: str = "ml/datasets/training_data.csv",
    model_output_path: str = "ml/models/isolation_forest_v1.joblib"
):
    if not os.path.exists(dataset_path):
        from generate_dataset import generate_synthetic_dataset
        generate_synthetic_dataset(output_path=dataset_path)

    df = pd.read_csv(dataset_path)
    feature_cols = [
        "order_value",
        "orders_per_minute",
        "cancellation_rate",
        "volume_ratio",
        "instruments_traded",
        "hour_of_activity",
        "is_new_device"
    ]
    X = df[feature_cols]

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )
    model.fit(X)

    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    joblib.dump(model, model_output_path)
    print(f"Successfully trained IsolationForest model and saved to {model_output_path}")

if __name__ == "__main__":
    train_model()
