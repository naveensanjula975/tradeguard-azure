#!/usr/bin/env bash
# =============================================================================
# TradeGuard — Service Health Monitor
# Usage: ./scripts/health.sh [--watch]
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

WATCH_MODE=false
[[ "${1:-}" == "--watch" || "${1:-}" == "-w" ]] && WATCH_MODE=true

# Service definitions: name|url|health_path
declare -a SERVICES=(
  "Ingestion Service  |http://localhost:8001|/health"
  "Anomaly Service    |http://localhost:8002|/health"
  "Alert-Case Service |http://localhost:8003|/health"
  "Simulator Service  |http://localhost:8004|/health"
  "Risk Engine        |http://localhost:8005|/health"
  "Frontend           |http://localhost:3000|/"
)

check_service() {
  local name="$1"
  local base_url="$2"
  local path="$3"
  local url="${base_url}${path}"

  local http_code response_time status_text

  # Use curl with timeout; capture HTTP code and time
  local result
  result=$(curl -o /dev/null -s -w "%{http_code} %{time_total}" --max-time 3 "$url" 2>/dev/null || echo "000 0")
  http_code=$(echo "$result" | awk '{print $1}')
  response_time=$(echo "$result" | awk '{printf "%.0fms", $2 * 1000}')

  if [[ "$http_code" =~ ^2 ]]; then
    printf "  ${GREEN}●${RESET} %-22s ${GREEN}%-8s${RESET} ${DIM}%s${RESET}  %s\n" \
      "$name" "UP" "$response_time" "${base_url}"
  elif [[ "$http_code" == "000" ]]; then
    printf "  ${RED}●${RESET} %-22s ${RED}%-8s${RESET} ${DIM}%s${RESET}\n" \
      "$name" "DOWN" "unreachable"
  else
    printf "  ${YELLOW}●${RESET} %-22s ${YELLOW}%-8s${RESET} ${DIM}HTTP $http_code  %s${RESET}\n" \
      "$name" "WARN" "${base_url}"
  fi
}

check_db() {
  if docker-compose ps postgres 2>/dev/null | grep -q "healthy\|Up"; then
    printf "  ${GREEN}●${RESET} %-22s ${GREEN}%-8s${RESET} ${DIM}%s${RESET}\n" \
      "PostgreSQL" "UP" "localhost:5432"
  else
    printf "  ${RED}●${RESET} %-22s ${RED}%-8s${RESET}\n" \
      "PostgreSQL" "DOWN"
  fi
}

print_status() {
  clear 2>/dev/null || true
  echo ""
  echo -e "${BOLD}${CYAN}🛡️  TradeGuard — Service Health${RESET}  $(date '+%H:%M:%S')"
  echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"
  check_db
  for svc in "${SERVICES[@]}"; do
    IFS='|' read -r name url path <<< "$svc"
    check_service "$name" "$url" "$path"
  done
  echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"
  if $WATCH_MODE; then
    echo -e "${DIM}  Refreshing every 5s — Ctrl+C to quit${RESET}"
  fi
  echo ""
}

if $WATCH_MODE; then
  while true; do
    print_status
    sleep 5
  done
else
  print_status
fi
