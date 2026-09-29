#!/usr/bin/env bash
# Genera tráfico contra los servicios para poblar Grafana con datos.
# Uso: ./scripts/load.sh [duración_segundos]  (default: 30)

set -euo pipefail

DURATION="${1:-30}"
EVENTS_URL="${EVENTS_URL:-http://localhost:5001}"
BOOKING_URL="${BOOKING_URL:-http://localhost:5002}"

EVENTS=(e1 e2 e3 e4)
EMAILS=(alice@example.com bob@example.com carol@example.com dan@example.com)

echo "Generando carga durante ${DURATION}s contra ${EVENTS_URL} y ${BOOKING_URL}..."

END=$(( $(date +%s) + DURATION ))
COUNT=0

while [ "$(date +%s)" -lt "$END" ]; do
  # Listar eventos
  curl -s "${EVENTS_URL}/events" > /dev/null

  # Detalle random
  EID="${EVENTS[$RANDOM % ${#EVENTS[@]}]}"
  curl -s "${EVENTS_URL}/events/${EID}" > /dev/null

  # Booking random (a veces)
  if (( RANDOM % 3 == 0 )); then
    EMAIL="${EMAILS[$RANDOM % ${#EMAILS[@]}]}"
    QTY=$(( (RANDOM % 3) + 1 ))
    curl -s -X POST "${BOOKING_URL}/bookings" \
      -H 'content-type: application/json' \
      -d "{\"eventId\":\"${EID}\",\"customerEmail\":\"${EMAIL}\",\"quantity\":${QTY}}" > /dev/null || true
  fi

  COUNT=$((COUNT + 1))
  sleep 0.2
done

echo "Listo. ${COUNT} iteraciones."
