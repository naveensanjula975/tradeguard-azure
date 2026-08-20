#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Developer Utility Script
# Usage: ./scripts/dev.sh <command> [options]
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}ℹ ${RESET}$*"; }
success() { echo -e "${GREEN}✔ ${RESET}$*"; }
warn()    { echo -e "${YELLOW}⚠ ${RESET}$*"; }
error()   { echo -e "${RED}✖ ${RESET}$*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Help ──────────────────────────────────────────────────────────────────────
usage() {
  echo -e "${BOLD}🛡️  TradeGuard Developer CLI${RESET}"
  echo ""
  echo -e "${BOLD}Usage:${RESET}  ./scripts/dev.sh <command> [options]"
  echo ""
  echo -e "${BOLD}Docker / Services:${RESET}"
  echo -e "  ${CYAN}up${RESET}           Start all services (build + detach)"
  echo -e "  ${CYAN}down${RESET}         Stop and remove all containers & volumes"
  echo -e "  ${CYAN}restart${RESET}      Restart all Docker containers"
  echo -e "  ${CYAN}status${RESET}       Show status of running containers"
  echo -e "  ${CYAN}logs [svc]${RESET}   Tail logs (optionally for a specific service)"
  echo -e "  ${CYAN}build [svc]${RESET}  Re-build Docker images (optionally a single service)"
  echo -e "  ${CYAN}shell <svc>${RESET}  Open an interactive shell inside a container"
  echo ""
  echo -e "${BOLD}Database:${RESET}"
  echo -e "  ${CYAN}db:seed${RESET}      Seed sample traders, accounts and alerts"
  echo -e "  ${CYAN}db:reset${RESET}     Drop volumes and re-seed the database"
  echo -e "  ${CYAN}db:psql${RESET}      Open a psql shell against the running DB"
  echo ""
  echo -e "${BOLD}Machine Learning:${RESET}"
  echo -e "  ${CYAN}ml:train${RESET}     Train the Isolation Forest anomaly model"
  echo -e "  ${CYAN}ml:eval${RESET}      Evaluate model performance on test dataset"
  echo ""
  echo -e "${BOLD}Testing:${RESET}"
  echo -e "  ${CYAN}test${RESET}         Run the full pytest test suite"
  echo -e "  ${CYAN}test:watch${RESET}   Run tests in watch mode (requires pytest-watch)"
  echo -e "  ${CYAN}test:cov${RESET}     Run tests with HTML coverage report"
  echo ""
  echo -e "${BOLD}Frontend:${RESET}"
  echo -e "  ${CYAN}fe:dev${RESET}       Run Next.js dev server locally"
  echo -e "  ${CYAN}fe:build${RESET}     Build the production Next.js bundle"
  echo -e "  ${CYAN}fe:lint${RESET}      Run ESLint on the frontend"
  echo ""
  echo -e "${BOLD}Simulation:${RESET}"
  echo -e "  ${CYAN}sim <scenario>${RESET}  Trigger a trade simulation scenario"
  echo -e "                   Scenarios: large_order | wash_trade | layering | spoofing"
  echo ""
  echo -e "${BOLD}Infrastructure:${RESET}"
  echo -e "  ${CYAN}tf:plan${RESET}      Terraform plan for Azure infrastructure"
  echo -e "  ${CYAN}tf:apply${RESET}     Terraform apply (requires confirmation)"
  echo -e "  ${CYAN}tf:destroy${RESET}   Terraform destroy (requires confirmation)"
  echo ""
  echo -e "${BOLD}Environment:${RESET}"
  echo -e "  ${CYAN}env:setup${RESET}    Copy .env.example → .env if not present"
  echo -e "  ${CYAN}env:check${RESET}    Verify all required tools are installed"
  echo -e "  ${CYAN}install${RESET}      Install all Python + Node dependencies"
  echo ""
}

# ── Guard: must be run from repo root ─────────────────────────────────────────
cd "$ROOT_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────
require_docker() {
  docker info &>/dev/null || error "Docker is not running. Please start Docker Desktop."
}

require_env() {
  [[ -f .env ]] || error ".env file not found. Run './scripts/dev.sh env:setup' first."
}

# ── Command dispatcher ────────────────────────────────────────────────────────
CMD="${1:-help}"
shift || true

case "$CMD" in

  # ── Docker ────────────────────────────────────────────────────────────────
  up)
    require_docker
    header "Starting TradeGuard Services"
    docker-compose up --build -d "$@"
    success "All services started. Frontend → http://localhost:3000"
    ;;

  down)
    require_docker
    header "Stopping TradeGuard Services"
    docker-compose down -v
    success "All containers and volumes removed."
    ;;

  restart)
    require_docker
    header "Restarting Services"
    docker-compose restart "$@"
    success "Services restarted."
    ;;

  status)
    require_docker
    header "Container Status"
    docker-compose ps
    ;;

  logs)
    require_docker
    if [[ -n "${1:-}" ]]; then
      docker-compose logs -f "$1"
    else
      docker-compose logs -f
    fi
    ;;

  build)
    require_docker
    header "Building Docker Images"
    if [[ -n "${1:-}" ]]; then
      docker-compose build "$1"
    else
      docker-compose build
    fi
    success "Build complete."
    ;;

  shell)
    require_docker
    [[ -z "${1:-}" ]] && error "Usage: dev.sh shell <service-name>"
    docker-compose exec "$1" /bin/bash || docker-compose exec "$1" /bin/sh
    ;;

  # ── Database ──────────────────────────────────────────────────────────────
  db:seed)
    header "Seeding Database"
    python shared/database/seed.py
    success "Database seeded."
    ;;

  db:reset)
    header "Resetting Database"
    warn "This will destroy all data. Ctrl+C to abort (5s)..."
    sleep 5
    docker-compose down -v
    docker-compose up -d postgres
    info "Waiting for Postgres to be healthy..."
    sleep 8
    python shared/database/seed.py
    success "Database reset and seeded."
    ;;

  db:psql)
    require_docker
    header "Opening psql shell"
    docker-compose exec postgres psql -U postgres -d tradeguard
    ;;

  # ── Machine Learning ──────────────────────────────────────────────────────
  ml:train)
    header "Training Isolation Forest Model"
    python ml/training/train_isolation_forest.py
    success "Model trained. Artifact saved to ml/models/"
    ;;

  ml:eval)
    header "Evaluating ML Model"
    if [[ -f "ml/training/evaluate.py" ]]; then
      python ml/training/evaluate.py
    else
      warn "No evaluate.py found. Running training script with --eval flag."
      python ml/training/train_isolation_forest.py --eval
    fi
    ;;

  # ── Testing ───────────────────────────────────────────────────────────────
  test)
    header "Running Test Suite"
    pytest tests/ -v "$@"
    ;;

  test:watch)
    header "Running Tests in Watch Mode"
    command -v ptw &>/dev/null || error "pytest-watch not installed. Run: pip install pytest-watch"
    ptw tests/ -- -v
    ;;

  test:cov)
    header "Running Tests with Coverage"
    pytest tests/ -v --cov=services --cov=shared --cov-report=html --cov-report=term
    success "HTML report → htmlcov/index.html"
    open htmlcov/index.html 2>/dev/null || true
    ;;

  # ── Frontend ──────────────────────────────────────────────────────────────
  fe:dev)
    header "Starting Frontend Dev Server"
    cd frontend && npm run dev
    ;;

  fe:build)
    header "Building Frontend"
    cd frontend && npm run build
    success "Build output in frontend/.next/"
    ;;

  fe:lint)
    header "Linting Frontend"
    cd frontend && npm run lint
    ;;

  # ── Simulation ────────────────────────────────────────────────────────────
  sim)
    SCENARIO="${1:-large_order}"
    COUNT="${2:-3}"
    header "Simulating: $SCENARIO (count=$COUNT)"
    curl -sf -X POST "http://localhost:8004/api/v1/simulation/scenario" \
      -H "Content-Type: application/json" \
      -d "{\"scenario\": \"$SCENARIO\", \"count\": $COUNT}" | python3 -m json.tool
    ;;

  # ── Infrastructure ────────────────────────────────────────────────────────
  tf:plan)
    header "Terraform Plan"
    cd infrastructure/terraform
    terraform init -upgrade
    terraform plan
    ;;

  tf:apply)
    header "Terraform Apply"
    warn "This will provision real Azure resources and incur costs."
    read -r -p "Type 'yes' to continue: " confirm
    [[ "$confirm" == "yes" ]] || error "Aborted."
    cd infrastructure/terraform
    terraform apply -auto-approve
    ;;

  tf:destroy)
    header "Terraform Destroy"
    warn "This will DESTROY all Azure resources."
    read -r -p "Type 'destroy' to confirm: " confirm
    [[ "$confirm" == "destroy" ]] || error "Aborted."
    cd infrastructure/terraform
    terraform destroy -auto-approve
    ;;

  # ── Environment ───────────────────────────────────────────────────────────
  env:setup)
    if [[ -f .env ]]; then
      warn ".env already exists. Delete it first to re-create."
    else
      cp .env.example .env
      success ".env created from .env.example. Fill in secrets before running services."
    fi
    ;;

  env:check)
    "$SCRIPTS_DIR/check-deps.sh"
    ;;

  install)
    header "Installing Dependencies"
    info "Installing shared Python package..."
    pip install -e shared/
    info "Installing ML requirements..."
    pip install -r ml/requirements.txt
    info "Installing frontend Node packages..."
    cd frontend && npm install && cd ..
    success "All dependencies installed."
    ;;

  help|--help|-h)
    usage
    ;;

  *)
    error "Unknown command: '$CMD'. Run './scripts/dev.sh help' for usage."
    ;;
esac
