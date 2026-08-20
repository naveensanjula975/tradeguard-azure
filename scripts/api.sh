#!/usr/bin/env bash
# =============================================================================
# TradeGuard — API Explorer (quick curl helpers)
# Usage: ./scripts/api.sh <resource> [options]
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Base URLs (override via env)
INGESTION="${INGESTION_SERVICE_URL:-http://localhost:8001}"
ANOMALY="${ANOMALY_SERVICE_URL:-http://localhost:8002}"
ALERT="${ALERT_CASE_SERVICE_URL:-http://localhost:8003}"
SIMULATOR="${SIMULATOR_SERVICE_URL:-http://localhost:8004}"
RISK="${RISK_ENGINE_URL:-http://localhost:8005}"

CMD="${1:-help}"
shift || true

header() { echo -e "\n${BOLD}${CYAN}▶  $*${RESET}\n"; }
pretty()  { python3 -m json.tool 2>/dev/null || cat; }

get() {
  local url="$1"
  echo -e "${DIM}GET $url${RESET}"
  curl -sf "$url" | pretty
}

post() {
  local url="$1"
  local body="${2:-{}}"
  echo -e "${DIM}POST $url${RESET}"
  echo -e "${DIM}Body: $body${RESET}\n"
  curl -sf -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$body" | pretty
}

usage() {
  echo -e "\n${BOLD}🛡️  TradeGuard API Explorer${RESET}\n"
  echo -e "${BOLD}Usage:${RESET}  ./scripts/api.sh <command> [args]\n"
  echo -e "${BOLD}Health:${RESET}"
  echo -e "  ${CYAN}health${RESET}                  Health check all services"
  echo -e "  ${CYAN}docs${RESET}                    Open Swagger UI for a service"
  echo ""
  echo -e "${BOLD}Trades (Ingestion — :8001):${RESET}"
  echo -e "  ${CYAN}trades:list${RESET}             List recent trades"
  echo -e "  ${CYAN}trades:submit${RESET}           Submit a sample trade"
  echo ""
  echo -e "${BOLD}Alerts (Alert-Case — :8003):${RESET}"
  echo -e "  ${CYAN}alerts:list${RESET}             List all alerts"
  echo -e "  ${CYAN}alerts:open${RESET}             List open alerts only"
  echo -e "  ${CYAN}alerts:get <id>${RESET}         Get a specific alert by ID"
  echo ""
  echo -e "${BOLD}Anomaly (Anomaly — :8002):${RESET}"
  echo -e "  ${CYAN}anomaly:detect${RESET}          Run anomaly detection on a sample trade"
  echo ""
  echo -e "${BOLD}Risk (Risk Engine — :8005):${RESET}"
  echo -e "  ${CYAN}risk:evaluate${RESET}           Evaluate risk on a sample trade"
  echo ""
}

case "$CMD" in

  health)
    header "Health Checks"
    for svc_info in \
      "Ingestion|$INGESTION/health" \
      "Anomaly|$ANOMALY/health" \
      "Alert-Case|$ALERT/health" \
      "Simulator|$SIMULATOR/health" \
      "Risk-Engine|$RISK/health"
    do
      IFS='|' read -r name url <<< "$svc_info"
      code=$(curl -o /dev/null -s -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo 000)
      if [[ "$code" =~ ^2 ]]; then
        echo -e "  ${GREEN}✔${RESET} $name — HTTP $code"
      else
        echo -e "  ${RED}✖${RESET} $name — HTTP $code (unreachable)"
      fi
    done
    ;;

  docs)
    echo -e "\n${BOLD}Swagger UI URLs:${RESET}"
    echo -e "  ${CYAN}Ingestion${RESET}   → $INGESTION/docs"
    echo -e "  ${CYAN}Anomaly${RESET}     → $ANOMALY/docs"
    echo -e "  ${CYAN}Alert-Case${RESET}  → $ALERT/docs"
    echo -e "  ${CYAN}Simulator${RESET}   → $SIMULATOR/docs"
    echo -e "  ${CYAN}Risk Engine${RESET} → $RISK/docs"
    echo ""
    # Open the alert-case Swagger (main UI)
    open "$ALERT/docs" 2>/dev/null || xdg-open "$ALERT/docs" 2>/dev/null || true
    ;;

  trades:list)
    header "Recent Trades"
    get "$INGESTION/api/v1/trades?limit=20"
    ;;

  trades:submit)
    header "Submitting Sample Trade"
    post "$INGESTION/api/v1/trades" '{
      "trader_id": "TRADER-001",
      "instrument_id": "AAPL",
      "order_type": "MARKET",
      "side": "BUY",
      "quantity": 500,
      "price": 182.50,
      "account_id": "ACC-001"
    }'
    ;;

  alerts:list)
    header "All Alerts"
    get "$ALERT/api/v1/alerts?limit=20"
    ;;

  alerts:open)
    header "Open Alerts"
    get "$ALERT/api/v1/alerts?status=open&limit=20"
    ;;

  alerts:get)
    [[ -z "${1:-}" ]] && { echo -e "${RED}Usage: api.sh alerts:get <alert-id>${RESET}"; exit 1; }
    header "Alert: $1"
    get "$ALERT/api/v1/alerts/$1"
    ;;

  anomaly:detect)
    header "Running Anomaly Detection"
    post "$ANOMALY/api/v1/detect" '{
      "trader_id": "TRADER-001",
      "instrument_id": "AAPL",
      "quantity": 50000,
      "price": 182.50,
      "order_type": "MARKET",
      "side": "BUY"
    }'
    ;;

  risk:evaluate)
    header "Evaluating Risk"
    post "$RISK/api/v1/evaluate" '{
      "trade": {
        "trader_id": "TRADER-001",
        "instrument_id": "AAPL",
        "quantity": 10000,
        "price": 182.50,
        "order_type": "MARKET",
        "side": "BUY"
      }
    }'
    ;;

  help|--help|-h)
    usage
    ;;

  *)
    echo -e "${RED}✖ Unknown command: '$CMD'${RESET}"
    usage
    exit 1
    ;;
esac
