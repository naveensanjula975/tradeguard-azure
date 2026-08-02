import os
import random
import pandas as pd

def generate_synthetic_dataset(num_samples: int = 5000, output_path: str = "ml/datasets/training_data.csv"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    data = []
    
    for _ in range(num_samples):
        # 95% normal activity, 5% anomalous activity
        is_anomaly = random.random() < 0.05
        
        if is_anomaly:
            order_value = random.uniform(50000, 500000)
            orders_per_minute = random.uniform(20, 100)
            cancellation_rate = random.uniform(0.5, 0.95)
            volume_ratio = random.uniform(3.0, 15.0)
            instruments_traded = random.randint(10, 50)
            hour_of_activity = random.choice([1, 2, 3, 4, 23]) # unusual hours
            is_new_device = random.choice([0, 1])
        else:
            order_value = random.uniform(100, 20000)
            orders_per_minute = random.uniform(1, 10)
            cancellation_rate = random.uniform(0.0, 0.2)
            volume_ratio = random.uniform(0.5, 1.8)
            instruments_traded = random.randint(1, 5)
            hour_of_activity = random.randint(9, 17) # market hours
            is_new_device = 0 if random.random() > 0.05 else 1

        data.append({
            "order_value": round(order_value, 2),
            "orders_per_minute": round(orders_per_minute, 2),
            "cancellation_rate": round(cancellation_rate, 2),
            "volume_ratio": round(volume_ratio, 2),
            "instruments_traded": instruments_traded,
            "hour_of_activity": hour_of_activity,
            "is_new_device": is_new_device,
            "label_anomaly": 1 if is_anomaly else 0
        })

    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False)
    print(f"Generated {num_samples} samples saved to {output_path}")

if __name__ == "__main__":
    generate_synthetic_dataset()
