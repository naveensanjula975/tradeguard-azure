.PHONY: help up down restart status logs \
        test test-unit test-integration test-cov \
        lint format type-check security \
        seed train-ml install-shared install-dev \
        dev-frontend simulate \
        migrate migrate-down db-shell \
        clean pre-commit-all

# ─────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "🛡️  TradeGuard Azure — Makefile Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "🐳 Docker & Services"
	@echo "  make up              Start all services (Docker Compose, detached)"
	@echo "  make down            Stop and remove all containers and volumes"
	@echo "  make restart         Restart Docker Compose environment"
	@echo "  make status          Show status of running containers"
	@echo "  make logs            Tail logs from all containers"
	@echo ""
	@echo "🧪 Testing"
	@echo "  make test            Run full pytest suite"
	@echo "  make test-unit       Run unit tests only (no Docker required)"
	@echo "  make test-integration Run integration tests (requires services up)"
	@echo "  make test-cov        Run tests with HTML coverage report"
	@echo ""
	@echo "🔍 Code Quality"
	@echo "  make lint            Run ruff linter"
	@echo "  make format          Auto-format code with ruff"
	@echo "  make type-check      Run mypy static type checker"
	@echo "  make security        Run bandit + pip-audit security scans"
	@echo "  make pre-commit-all  Run all pre-commit hooks on every file"
	@echo ""
	@echo "🗄️  Database"
	@echo "  make seed            Seed sample database data"
	@echo "  make migrate         Run Alembic migrations (upgrade head)"
	@echo "  make migrate-down    Roll back one Alembic migration"
	@echo "  make db-shell        Open psql shell to local database"
	@echo ""
	@echo "🤖 ML"
	@echo "  make train-ml        Train Isolation Forest model"
	@echo ""
	@echo "📦 Setup"
	@echo "  make install-shared  Install shared Python package (editable)"
	@echo "  make install-dev     Install all dev dependencies"
	@echo ""
	@echo "🌐 Frontend"
	@echo "  make dev-frontend    Run Next.js dev server (hot reload)"
	@echo ""
	@echo "🎯 Simulator"
	@echo "  make simulate        Fire sample large_order trade scenario"
	@echo "  make simulate-wash   Fire wash trade scenario"
	@echo "  make simulate-spoof  Fire spoofing ladder scenario"
	@echo ""
	@echo "🧹 Cleanup"
	@echo "  make clean           Remove build artifacts, caches, coverage reports"
	@echo ""

# ─────────────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────────────
up:
	docker-compose up --build -d

down:
	docker-compose down -v

restart:
	docker-compose restart

status:
	docker-compose ps

logs:
	docker-compose logs -f

# ─────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────
test:
	pytest tests/ -v

test-unit:
	pytest tests/unit/ -v -m unit

test-integration:
	pytest tests/integration/ -v -m integration

test-cov:
	pytest tests/ \
		--cov=services \
		--cov=shared \
		--cov-report=html:htmlcov \
		--cov-report=term-missing
	@echo "📊 Coverage report: open htmlcov/index.html"

# ─────────────────────────────────────────────────────────
# Code Quality
# ─────────────────────────────────────────────────────────
lint:
	ruff check .

format:
	ruff format .
	ruff check --fix .

type-check:
	mypy services/ shared/ --ignore-missing-imports

security:
	@echo "🔐 Running bandit SAST scan..."
	bandit -r services/ shared/ -ll
	@echo ""
	@echo "📦 Running pip-audit dependency scan..."
	pip-audit -r requirements-dev.txt || true

pre-commit-all:
	pre-commit run --all-files

# ─────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────
seed:
	python shared/database/seed.py

migrate:
	alembic -c shared/alembic.ini upgrade head

migrate-down:
	alembic -c shared/alembic.ini downgrade -1

db-shell:
	docker exec -it tradeguard-db psql -U postgres -d tradeguard

# ─────────────────────────────────────────────────────────
# Machine Learning
# ─────────────────────────────────────────────────────────
train-ml:
	python ml/training/train_isolation_forest.py

# ─────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────
install-shared:
	pip install -e shared/

install-dev:
	pip install -e shared/
	pip install -r requirements-dev.txt
	pre-commit install
	pre-commit install --hook-type commit-msg

# ─────────────────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────────────────
dev-frontend:
	cd frontend && npm run dev

# ─────────────────────────────────────────────────────────
# Simulator scenarios
# ─────────────────────────────────────────────────────────
simulate:
	curl -s -X POST http://localhost:8004/api/v1/simulation/scenario \
		-H "Content-Type: application/json" \
		-d '{"scenario": "large_order", "count": 3}' | python -m json.tool

simulate-wash:
	curl -s -X POST http://localhost:8004/api/v1/simulation/scenario \
		-H "Content-Type: application/json" \
		-d '{"scenario": "wash_trade", "count": 2}' | python -m json.tool

simulate-spoof:
	curl -s -X POST http://localhost:8004/api/v1/simulation/scenario \
		-H "Content-Type: application/json" \
		-d '{"scenario": "spoofing_ladder", "count": 5}' | python -m json.tool

# ─────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name htmlcov -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".coverage" -delete 2>/dev/null || true
	find . -name "coverage.xml" -delete 2>/dev/null || true
	@echo "🧹 Cleaned build artifacts and caches"
