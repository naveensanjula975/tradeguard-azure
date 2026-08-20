#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Cleanup Script
# Removes build artifacts, Python caches, and Docker orphans.
# Usage: ./scripts/clean.sh [--all] [--docker] [--pyc]
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DO_DOCKER=false
DO_PYC=false
DO_NODE=false
DO_ML=false
DO_ALL=false

usage() {
  echo -e "\n${BOLD}TradeGuard Cleanup Script${RESET}\n"
  echo -e "${BOLD}Usage:${RESET}  ./scripts/clean.sh [flags]\n"
  echo -e "  ${CYAN}--pyc${RESET}      Remove Python __pycache__ and .pyc files"
  echo -e "  ${CYAN}--docker${RESET}   Remove stopped containers, dangling images, unused volumes"
  echo -e "  ${CYAN}--node${RESET}     Remove node_modules and .next build output"
  echo -e "  ${CYAN}--ml${RESET}       Remove trained ML model artifacts"
  echo -e "  ${CYAN}--all${RESET}      Run all cleanup steps"
  echo ""
}

[[ $# -eq 0 ]] && { usage; exit 0; }

for arg in "$@"; do
  case "$arg" in
    --pyc)    DO_PYC=true ;;
    --docker) DO_DOCKER=true ;;
    --node)   DO_NODE=true ;;
    --ml)     DO_ML=true ;;
    --all)    DO_ALL=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo -e "${RED}Unknown flag: $arg${RESET}"; usage; exit 1 ;;
  esac
done

header() { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }
info()    { echo -e "   ${DIM}$*${RESET}"; }
done_()   { echo -e "   ${GREEN}✔ $*${RESET}"; }

# ── Python caches ─────────────────────────────────────────────────────────────
if $DO_PYC || $DO_ALL; then
  header "Python Cache"
  info "Removing __pycache__ directories..."
  find . -type d -name "__pycache__" -not -path "./.git/*" -exec rm -rf {} + 2>/dev/null || true
  info "Removing .pyc files..."
  find . -name "*.pyc" -not -path "./.git/*" -delete 2>/dev/null || true
  info "Removing .pytest_cache..."
  rm -rf .pytest_cache
  info "Removing .coverage and htmlcov/..."
  rm -rf .coverage htmlcov/
  done_ "Python caches cleared"
fi

# ── Docker ────────────────────────────────────────────────────────────────────
if $DO_DOCKER || $DO_ALL; then
  header "Docker Cleanup"
  if docker info &>/dev/null; then
    info "Removing stopped containers..."
    docker container prune -f
    info "Removing dangling images..."
    docker image prune -f
    info "Removing unused volumes..."
    docker volume prune -f
    info "Removing unused networks..."
    docker network prune -f
    done_ "Docker cleanup complete"
  else
    echo -e "   ${YELLOW}⚠ Docker is not running, skipping${RESET}"
  fi
fi

# ── Node / Frontend ───────────────────────────────────────────────────────────
if $DO_NODE || $DO_ALL; then
  header "Frontend Build Artifacts"
  info "Removing frontend/node_modules..."
  rm -rf frontend/node_modules
  info "Removing frontend/.next..."
  rm -rf frontend/.next
  done_ "Frontend artifacts cleared"
fi

# ── ML model artifacts ────────────────────────────────────────────────────────
if $DO_ML || $DO_ALL; then
  header "ML Model Artifacts"
  if ls ml/models/*.joblib &>/dev/null 2>&1; then
    info "Removing trained model files..."
    rm -f ml/models/*.joblib
    done_ "Model artifacts removed"
  else
    info "No model artifacts found."
  fi
fi

echo -e "\n${GREEN}${BOLD}✔ Cleanup complete.${RESET}\n"
