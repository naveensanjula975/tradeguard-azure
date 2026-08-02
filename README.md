# TradeGuard Azure MVP

**TradeGuard** is a Python-based, cloud-native trade surveillance and risk-detection platform designed to process simulated trading events in real time, apply rule-based & machine-learning risk scoring, and present suspicious alerts via an investigation dashboard.

## 🏛 Repository Architecture

```text
tradeguard-azure/
├── services/
│   ├── simulator/             # Simulated trading event generator
│   ├── ingestion-service/     # FastAPI trade event validator & publisher
│   ├── risk-engine/           # Real-time event consumer & 5 risk rule evaluator
│   ├── anomaly-service/       # Scikit-learn Isolation Forest ML inference service
│   └── alert-case-service/    # Alert storage, case investigation & dashboard API
├── shared/                    # Shared Pydantic contracts, ORM models & logging utilities
├── frontend/                  # Next.js & TypeScript compliance investigation dashboard
├── ml/                        # Dataset generation & model training scripts
├── infrastructure/            # Terraform manifests for Azure resources
└── tests/                     # Unit and integration test suites
```

## 🚀 Quick Start (Local Setup)

### Prerequisites
* Docker & Docker Compose
* Python 3.12+
* Node.js 20+

### Step 1: Clone & Configure
```bash
cp .env.example .env
```

### Step 2: Run Services with Docker Compose
```bash
docker-compose up --build
```

### Step 3: Run Tests
```bash
pytest tests/
```

## 📜 MVP Specification
For full technical specifications, database schema models, risk rules, and demonstration workflows, see [mvp.md](mvp.md).
