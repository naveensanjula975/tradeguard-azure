.PHONY: help up down restart status logs test seed train-ml install-shared dev-frontend simulate

help:
	@echo "🛡️ TradeGuard Azure — Development Makefile Commands:"
	@echo "  make up             - Start all services with Docker Compose"
	@echo "  make down           - Stop and remove all containers and volumes"
	@echo "  make restart        - Restart Docker Compose environment"
	@echo "  make status         - Check status of running containers"
	@echo "  make logs           - Tail logs from all Docker containers"
	@echo "  make test           - Run pytest test suite"
	@echo "  make seed           - Seed sample database data (traders, accounts, alerts)"
	@echo "  make train-ml       - Train Isolation Forest ML model"
	@echo "  make install-shared - Install shared Python package locally in editable mode"
	@echo "  make dev-frontend   - Run Next.js frontend dev server locally"
	@echo "  make simulate       - Trigger sample trade simulation scenario"

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

test:
	pytest tests/ -v

seed:
	python shared/database/seed.py

train-ml:
	python ml/training/train_isolation_forest.py

install-shared:
	pip install -e shared/

dev-frontend:
	cd frontend && npm run dev

simulate:
	curl -X POST http://localhost:8004/api/v1/simulation/scenario -H "Content-Type: application/json" -d '{"scenario": "large_order", "count": 3}'
