#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Trade Scenario Simulator
# Sends realistic trade simulation payloads to the Simulator service.
# Usage: ./scripts/simulate.sh [scenario] [count]
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

SIMULATOR_URL="${SIMULATOR_SERVICE_URL:-http://localhost:8004}"
SCENARIO="${1:-}"
COUNT="${2:-3}"

usage() {
  echo -e "\n${BOLD}🎯 TradeGuard — Trade Simulator${RESET}\n"
  echo -e "${BOLD}Usage:${RESET}  ./scripts/simulate.sh <scenario> [count]\n"
  echo -e "${BOLD}Scenarios:${RESET}"
  echo -e "  ${CYAN}large_order${RESET}   — Simulate unusually large order submissions"
  echo -e "  ${CYAN}wash_trade${RESET}    — Circular buy/sell patterns (market manipulation)"
  echo -e "  ${CYAN}layering${RESET}      — Multiple rapid orders then cancellations"
  echo -e "  ${CYAN}spoofing${RESET}      — Spoofing order book with fake intent"
  echo -e "  ${CYAN}normal${RESET}        — Normal legitimate trading activity"
  echo -e "  ${CYAN}stress${RESET}        — High-volume burst of mixed trades (stress test)"
  echo -e "  ${CYAN}all${RESET}           — Run all manipulation scenarios sequentially"
  echo ""
  echo -e "${BOLD}Examples:${RESET}"
  echo -e "  ./scripts/simulate.sh large_order 5"
  echo -e "  ./scripts/simulate.sh wash_trade"
  echo -e "  ./scripts/simulate.sh all"
  echo ""
}

post_scenario() {
  local scenario="$1"
  local count="${2:-3}"

  echo -e "\n${BOLD}${CYAN}▶  Scenario: $scenario  (count=$count)${RESET}"
  echo -e "${DIM}   POST ${SIMULATOR_URL}/api/v1/simulation/scenario${RESET}\n"

  local response
  response=$(curl -sf -X POST "${SIMULATOR_URL}/api/v1/simulation/scenario" \
    -H "Content-Type: application/json" \
    -d "{\"scenario\": \"$scenario\", \"count\": $count}" 2>&1) || {
      echo -e "${RED}✖ Could not reach Simulator at ${SIMULATOR_URL}${RESET}"
      echo -e "${DIM}   Make sure services are running: ./scripts/dev.sh up${RESET}"
      return 1
    }

  echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
  echo -e "\n${GREEN}✔ Scenario '$scenario' dispatched${RESET}"
}

if [[ -z "$SCENARIO" ]]; then
  usage
  exit 0
fi

case "$SCENARIO" in
  large_order|wash_trade|layering|spoofing|normal)
    post_scenario "$SCENARIO" "$COUNT"
    ;;

  stress)
    echo -e "\n${BOLD}${YELLOW}⚡ Stress Test — sending burst of mixed trades${RESET}"
    scenarios=("normal" "normal" "large_order" "layering" "normal" "spoofing")
    for s in "${scenarios[@]}"; do
      post_scenario "$s" 5
      sleep 1
    done
    echo -e "\n${GREEN}${BOLD}✔ Stress test complete${RESET}"
    ;;

  all)
    echo -e "\n${BOLD}${CYAN}Running all manipulation scenarios...${RESET}"
    for s in "large_order" "wash_trade" "layering" "spoofing"; do
      post_scenario "$s" "$COUNT"
      sleep 2
    done
    echo -e "\n${GREEN}${BOLD}✔ All scenarios complete — check alerts at http://localhost:8003/docs${RESET}"
    ;;

  *)
    echo -e "${RED}✖ Unknown scenario: '$SCENARIO'${RESET}"
    usage
    exit 1
    ;;
esac
