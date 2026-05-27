#!/usr/bin/env bash
# Produces random DLQ messages to a Kafka topic via rpk inside the Redpanda container.
# If the subject <topic>-value exists in Schema Registry the payload is Avro-encoded
# with Confluent wire format (magic byte + 4-byte schema ID + binary).
# Usage: ./scripts/seed-dlq.sh [topic] [count]
#   topic  — default: orders.dlq
#   count  — default: 20

set -euo pipefail

TOPIC="${1:-orders.dlq}"
COUNT="${2:-20}"
BROKER="localhost:9092"
SR_URL="http://localhost:8081"
CONTAINER="docker-redpanda-1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── sanity checks ────────────────────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}Container '${CONTAINER}' not running.${NC}"
  echo "Start the stack first:  docker compose -f docker/docker-compose.dev.yml up -d"
  exit 1
fi

if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo -e "${RED}count must be a positive integer, got: $COUNT${NC}"
  exit 1
fi

# ── macOS-compatible random helpers ─────────────────────────────────────────
pick() {
  local arr=("$@")
  echo "${arr[$(( RANDOM % ${#arr[@]} ))]}"
}

rand_price() {
  printf '%d.%02d' "$(( 5 + RANDOM % 995 ))" "$(( RANDOM % 100 ))"
}

# ── data pools ───────────────────────────────────────────────────────────────
EX_CLASSES=(
  "it.dls.domain.order.InvalidOrderException"
  "it.dls.domain.payment.PaymentDeclinedException"
  "it.dls.domain.inventory.InventoryUnavailableException"
  "it.dls.domain.customer.CustomerNotFoundException"
  "it.dls.domain.order.PriceValidationException"
  "it.dls.domain.order.DuplicateOrderException"
  "it.dls.domain.shipping.ShippingAddressUnresolvableException"
  "it.dls.domain.order.OrderValidationException"
)
EX_MESSAGES=(
  "Required field 'shippingAddress' is null"
  "Payment declined: insufficient funds on card ending 4242"
  "SKU not available in requested quantity"
  "Customer not found in CRM system"
  "Price mismatch: catalog price differs from order price"
  "Order with this idempotency key already processed"
  "Shipping address could not be resolved to a valid postal zone"
  "Order total exceeds maximum allowed per transaction"
)
SKUS=("LAPTOP-PRO-15" "MOUSE-WL-001" "KB-MECH-TKL" "MONITOR-4K-27" "HEADSET-USB-C" "WEBCAM-HD-1080" "DOCK-TB4" "SSD-1TB-NVME" "CHAIR-ERG-01" "DESK-ADJ-120")
CURRENCIES=("EUR" "USD" "GBP")
CUSTOMERS=("cust-1001" "cust-2045" "cust-3312" "cust-4879" "cust-5001" "cust-6234" "cust-7720" "cust-8843")
ORIG_TOPICS=("orders" "orders-v2" "orders-eu" "orders-us")

# ── ensure topic exists ──────────────────────────────────────────────────────
echo -e "${YELLOW}Ensuring topic '${TOPIC}' exists (3 partitions)...${NC}"
docker exec "$CONTAINER" rpk topic create "$TOPIC" --partitions 3 2>/dev/null \
  && echo -e "  Topic created." \
  || echo -e "  Topic already exists."

# ── detect schema registry subject ───────────────────────────────────────────
SR_SUBJECT="${TOPIC}-value"
USE_AVRO=false
if curl -sf "${SR_URL}/subjects/${SR_SUBJECT}/versions/latest" > /dev/null 2>&1; then
  USE_AVRO=true
  echo -e "${YELLOW}Schema found for '${SR_SUBJECT}' — producing Avro (Confluent wire format).${NC}"
else
  echo -e "${YELLOW}No schema for '${SR_SUBJECT}' — producing raw JSON.${NC}"
  echo -e "  Run ./scripts/register-schema.sh to enable Avro encoding."
fi

# ── produce messages ─────────────────────────────────────────────────────────
echo -e "${YELLOW}Producing ${COUNT} messages to '${TOPIC}'...${NC}\n"

SUCCESS=0
FAIL=0

for i in $(seq 1 "$COUNT"); do
  ORDER_ID="ORD-$(( 100000 + RANDOM % 900000 ))"
  CUSTOMER=$(pick "${CUSTOMERS[@]}")
  SKU=$(pick "${SKUS[@]}")
  QTY=$(( 1 + RANDOM % 10 ))
  UNIT_PRICE=$(rand_price)
  TOTAL=$(awk "BEGIN { printf \"%.2f\", $QTY * $UNIT_PRICE }")
  CURRENCY=$(pick "${CURRENCIES[@]}")
  EX_CLASS=$(pick "${EX_CLASSES[@]}")
  EX_MSG=$(pick "${EX_MESSAGES[@]}")
  ORIG_TOPIC=$(pick "${ORIG_TOPICS[@]}")
  ORIG_PARTITION=$(( RANDOM % 3 ))
  ORIG_OFFSET=$(( RANDOM % 100000 ))
  RETRY_COUNT=$(( RANDOM % 4 ))
  CORR_ID="corr-$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c 16 || echo "${RANDOM}${RANDOM}${RANDOM}${RANDOM}")"
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  PAYLOAD="{\"orderId\":\"${ORDER_ID}\",\"customerId\":\"${CUSTOMER}\",\"item\":{\"sku\":\"${SKU}\",\"qty\":${QTY},\"unitPrice\":${UNIT_PRICE},\"currency\":\"${CURRENCY}\"},\"total\":${TOTAL},\"timestamp\":\"${TIMESTAMP}\",\"correlationId\":\"${CORR_ID}\"}"

  SCHEMA_FLAGS=()
  if [[ "$USE_AVRO" == "true" ]]; then
    SCHEMA_FLAGS=(--schema-id topic -X registry.hosts=localhost:8081)
  fi

  if echo "$PAYLOAD" | docker exec -i "$CONTAINER" rpk topic produce "$TOPIC" \
      "${SCHEMA_FLAGS[@]+"${SCHEMA_FLAGS[@]}"}" \
      -H "x-original-topic:${ORIG_TOPIC}" \
      -H "x-exception-class:${EX_CLASS}" \
      -H "x-exception-message:${EX_MSG}" \
      -H "x-original-partition:${ORIG_PARTITION}" \
      -H "x-original-offset:${ORIG_OFFSET}" \
      -H "x-retry-count:${RETRY_COUNT}" \
      -k "$ORDER_ID" \
      --brokers "$BROKER" 2>/dev/null; then
    SUCCESS=$(( SUCCESS + 1 ))
    SHORT_EX="${EX_CLASS##*.}"
    echo -e "  ${GREEN}[${i}/${COUNT}]${NC} ${ORDER_ID}  ${CUSTOMER}  ${QTY}x ${SKU}  →  ${SHORT_EX}"
  else
    FAIL=$(( FAIL + 1 ))
    echo -e "  ${RED}[${i}/${COUNT}] FAILED${NC} ${ORDER_ID}"
  fi
done

echo
echo -e "${GREEN}Done.${NC}  produced=${SUCCESS}  failed=${FAIL}  topic=${TOPIC}"
