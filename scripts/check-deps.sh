#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Dependency Checker
# Verifies all required tools are installed and at the right versions.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "  ${GREEN}✔${RESET}  $1"; }
fail() { echo -e "  ${RED}✖${RESET}  $1"; FAILED=1; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }

FAILED=0

echo -e "\n${BOLD}${CYAN}🛡️  TradeGuard — Dependency Check${RESET}\n"

# ── Runtime tools ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Runtime Tools:${RESET}"

check_tool() {
  local name="$1"
  local cmd="$2"
  local version_flag="${3:---version}"
  if command -v "$cmd" &>/dev/null; then
    pass "$name ($(command -v "$cmd")) — $($cmd $version_flag 2>&1 | head -1)"
  else
    fail "$name is NOT installed"
  fi
}

check_tool "Docker"          docker  "--version"
check_tool "Docker Compose"  docker-compose "--version"
check_tool "Python 3"        python3 "--version"
check_tool "pip"             pip     "--version"
check_tool "Node.js"         node    "--version"
check_tool "npm"             npm     "--version"
check_tool "curl"            curl    "--version"
check_tool "jq"              jq      "--version"

# Optional tools
echo ""
echo -e "${BOLD}Optional Tools:${RESET}"
check_tool "Terraform"  terraform "--version" 2>/dev/null || warn "Terraform not found (needed for Azure infra deployment)"
check_tool "Azure CLI"  az        "--version"  2>/dev/null || warn "Azure CLI not found (az) — needed for Azure deployments"

# ── Python packages ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Python Packages:${RESET}"
python_packages=("pytest" "fastapi" "uvicorn" "sqlalchemy" "psycopg2" "scikit-learn" "pandas")
for pkg in "${python_packages[@]}"; do
  if python3 -c "import $pkg" 2>/dev/null; then
    ver=$(python3 -c "import $pkg; print(getattr($pkg, '__version__', 'installed'))" 2>/dev/null || echo "installed")
    pass "$pkg ($ver)"
  else
    warn "$pkg not found (run './scripts/dev.sh install')"
  fi
done

# ── .env file ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuration:${RESET}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  pass ".env file present"
else
  fail ".env file missing — run './scripts/dev.sh env:setup'"
fi

# ── Docker status ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Docker Status:${RESET}"
if docker info &>/dev/null; then
  pass "Docker daemon is running"
else
  fail "Docker daemon is NOT running"
fi

# ── Port availability ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Port Availability (local):${RESET}"
ports=(3000 5432 8001 8002 8003 8004 8005)
service_names=("Frontend" "PostgreSQL" "Ingestion" "Anomaly" "Alert-Case" "Simulator" "Risk-Engine")
for i in "${!ports[@]}"; do
  port="${ports[$i]}"
  svc="${service_names[$i]}"
  if lsof -i TCP:"$port" -sTCP:LISTEN &>/dev/null; then
    warn "Port $port ($svc) is already in use"
  else
    pass "Port $port ($svc) is free"
  fi
done

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✔ All critical checks passed!${RESET}"
else
  echo -e "${RED}${BOLD}✖ Some checks failed. Fix the issues above before running services.${RESET}"
  exit 1
fi
echo ""
