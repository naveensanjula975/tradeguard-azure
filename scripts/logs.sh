#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Logs Viewer with Service Filtering
# Usage: ./scripts/logs.sh [service] [--lines N] [--grep PATTERN]
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
YELLOW='\033[1;33m'
RED='\033[0;31m'

SERVICE=""
LINES=100
GREP_PATTERN=""
FOLLOW=true

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lines|-n)   LINES="$2";        shift 2 ;;
    --grep|-g)    GREP_PATTERN="$2"; shift 2 ;;
    --no-follow)  FOLLOW=false;      shift ;;
    --help|-h)
      echo -e "\n${BOLD}TradeGuard Log Viewer${RESET}\n"
      echo -e "${BOLD}Usage:${RESET}  ./scripts/logs.sh [service] [options]\n"
      echo -e "${BOLD}Services:${RESET}"
      echo -e "  postgres  anomaly-service  ingestion-service"
      echo -e "  alert-case-service  simulator  risk-engine  frontend\n"
      echo -e "${BOLD}Options:${RESET}"
      echo -e "  --lines N         Show last N lines (default: 100)"
      echo -e "  --grep PATTERN    Filter lines matching PATTERN"
      echo -e "  --no-follow       Print logs and exit (no tailing)\n"
      echo -e "${BOLD}Examples:${RESET}"
      echo -e "  ./scripts/logs.sh"
      echo -e "  ./scripts/logs.sh ingestion-service"
      echo -e "  ./scripts/logs.sh risk-engine --grep ERROR"
      echo -e "  ./scripts/logs.sh --no-follow --lines 50"
      exit 0
      ;;
    -*) echo -e "${RED}Unknown option: $1${RESET}"; exit 1 ;;
    *)  SERVICE="$1"; shift ;;
  esac
done

echo -e "\n${BOLD}${CYAN}🛡️  TradeGuard Logs${RESET}"
if [[ -n "$SERVICE" ]]; then
  echo -e "${DIM}Service: $SERVICE${RESET}"
fi
if [[ -n "$GREP_PATTERN" ]]; then
  echo -e "${DIM}Filter: $GREP_PATTERN${RESET}"
fi
echo ""

# ── Build docker-compose logs command ─────────────────────────────────────────
COMPOSE_CMD=("docker-compose" "logs" "--tail=$LINES")
$FOLLOW && COMPOSE_CMD+=("-f")
[[ -n "$SERVICE" ]] && COMPOSE_CMD+=("$SERVICE")

# ── Run with optional grep ─────────────────────────────────────────────────────
if [[ -n "$GREP_PATTERN" ]]; then
  "${COMPOSE_CMD[@]}" 2>&1 | grep -i --color=always "$GREP_PATTERN" || true
else
  "${COMPOSE_CMD[@]}"
fi
