#!/usr/bin/env bash
# Produces random DLQ messages to a Kafka topic via Confluent Kafka CLI tools.
# Plain JSON if no schema registered; Avro (Confluent wire format) if subject exists.
#
# Usage: ./scripts/seed-dlq.sh [--header] [topic] [count]
#   --header  — also emit SmallRye dead-letter-* headers (exception-class-name, reason,
#               topic, partition, offset; cause and cause-class-name on ~half of messages)
#   topic     — default: orders.dlq
#   count     — default: 20
#
# Requires the dev stack running:
#   docker compose -f docker/docker-compose.dev.yml up -d

set -euo pipefail

TOPIC="orders.dlq"
COUNT=20
FRAMEWORK_HEADERS=false
POSITIONAL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --header) FRAMEWORK_HEADERS=true; shift ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *)
      POSITIONAL=$(( POSITIONAL + 1 ))
      case "$POSITIONAL" in
        1) TOPIC="$1" ;;
        2) COUNT="$1" ;;
        *) echo "Unexpected argument: $1"; exit 1 ;;
      esac
      shift ;;
  esac
done

KAFKA_CONTAINER="dls-dev-kafka"
SR_CONTAINER="dls-dev-schema-registry"
BROKER_INTERNAL="kafka:29092"          # INTERNAL listener — used from SR container within Docker network
SR_URL="http://localhost:8081"         # exposed on host

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

# ── validate ─────────────────────────────────────────────────────────────────
if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo -e "${RED}count must be a positive integer, got: $COUNT${NC}"; exit 1
fi

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${KAFKA_CONTAINER}$"; then
  echo -e "${RED}Container '${KAFKA_CONTAINER}' not running.${NC}"
  echo "Start the stack:  docker compose -f docker/docker-compose.dev.yml up -d"
  exit 1
fi

# ── helpers ───────────────────────────────────────────────────────────────────
pick()       { local arr=("$@"); echo "${arr[$(( RANDOM % ${#arr[@]} ))]}"; }
rand_price() { printf '%d.%02d' "$(( 5 + RANDOM % 995 ))" "$(( RANDOM % 100 ))"; }

# ── data pools ────────────────────────────────────────────────────────────────
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
  "Required field shippingAddress is null"
  "Payment declined: insufficient funds"
  "SKU not available in requested quantity"
  "Customer not found in CRM system"
  "Price mismatch: catalog price differs from order"
  "Order with this idempotency key already processed"
  "Shipping address could not be resolved to a postal zone"
  "Order total exceeds maximum allowed per transaction"
)
CAUSE_CLASSES=(
  "java.lang.NullPointerException"
  "java.sql.SQLTransientConnectionException"
  "java.util.concurrent.TimeoutException"
  "com.fasterxml.jackson.core.JsonParseException"
)
CAUSE_MESSAGES=(
  "Cannot invoke getShippingAddress() on null"
  "Connection to orders-db timed out"
  "Upstream call exceeded 5000 ms"
  "Unexpected character at line 1 column 42"
)
SKUS=("LAPTOP-PRO-15" "MOUSE-WL-001" "KB-MECH-TKL" "MONITOR-4K-27" "HEADSET-USB-C"
      "WEBCAM-HD-1080" "DOCK-TB4" "SSD-1TB-NVME" "CHAIR-ERG-01" "DESK-ADJ-120")
CURRENCIES=("EUR" "USD" "GBP")
CUSTOMERS=("cust-1001" "cust-2045" "cust-3312" "cust-4879"
           "cust-5001" "cust-6234" "cust-7720" "cust-8843")
ORIG_TOPICS=("orders" "orders-v2" "orders-eu" "orders-us")

# ── ensure topic exists ───────────────────────────────────────────────────────
echo -e "${YELLOW}Ensuring topic '${TOPIC}' exists (3 partitions)...${NC}"
docker exec "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "$TOPIC" --partitions 3 --replication-factor 1 2>/dev/null \
  && echo "  Topic created." || echo "  Topic already exists."

# ── detect schema ─────────────────────────────────────────────────────────────
SR_SUBJECT="${TOPIC}-value"
USE_AVRO=false
SCHEMA_ID=""

if curl -sf "${SR_URL}/subjects/${SR_SUBJECT}/versions/latest" > /dev/null 2>&1; then
  USE_AVRO=true
  SCHEMA_ID=$(curl -sf "${SR_URL}/subjects/${SR_SUBJECT}/versions/latest" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
  echo -e "${YELLOW}Schema found for '${SR_SUBJECT}' (id=${SCHEMA_ID}) — producing Avro.${NC}"
else
  echo -e "${YELLOW}No schema for '${SR_SUBJECT}' — producing plain JSON.${NC}"
  echo "  Run ./scripts/register-schema.sh to enable Avro encoding."
fi

if [[ "$USE_AVRO" == "true" && "$FRAMEWORK_HEADERS" == "true" ]]; then
  echo -e "${YELLOW}Warning: --header ignored in Avro mode (SchemaMessageReader does not support custom headers).${NC}"
fi

# ── build messages ────────────────────────────────────────────────────────────
echo -e "${YELLOW}Building ${COUNT} messages...${NC}"
TMPFILE=$(mktemp)
TMPFILE_AVRO=$(mktemp)
trap "rm -f $TMPFILE $TMPFILE_AVRO" EXIT

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
  CORR_ID="corr-$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c 16 \
             || echo "${RANDOM}${RANDOM}${RANDOM}${RANDOM}")"
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  PAYLOAD="{\"orderId\":\"${ORDER_ID}\",\"customerId\":\"${CUSTOMER}\",\
\"item\":{\"sku\":\"${SKU}\",\"qty\":${QTY},\"unitPrice\":${UNIT_PRICE},\"currency\":\"${CURRENCY}\"},\
\"total\":${TOTAL},\"timestamp\":\"${TIMESTAMP}\",\"correlationId\":\"${CORR_ID}\"}"

  HEADERS="x-original-topic:${ORIG_TOPIC}|x-exception-class:${EX_CLASS}\
|x-exception-message:${EX_MSG}|x-original-partition:${ORIG_PARTITION}\
|x-original-offset:${ORIG_OFFSET}|x-retry-count:${RETRY_COUNT}"

  if [[ "$FRAMEWORK_HEADERS" == "true" ]]; then
    HEADERS="${HEADERS}\
|dead-letter-exception-class-name:${EX_CLASS}\
|dead-letter-reason:${EX_MSG}\
|dead-letter-topic:${ORIG_TOPIC}\
|dead-letter-partition:${ORIG_PARTITION}\
|dead-letter-offset:${ORIG_OFFSET}"
    # SmallRye only sets the cause headers when the failure carries a cause
    if (( RANDOM % 2 )); then
      CAUSE_IDX=$(( RANDOM % ${#CAUSE_CLASSES[@]} ))
      HEADERS="${HEADERS}\
|dead-letter-cause:${CAUSE_MESSAGES[$CAUSE_IDX]}\
|dead-letter-cause-class-name:${CAUSE_CLASSES[$CAUSE_IDX]}"
    fi
  fi

  # JSON path: HEADERS<TAB>KEY<TAB>VALUE
  # headers.separator defaults to comma; headers.key.separator=: (explicit)
  HEADERS_CSV=$(echo "$HEADERS" | tr '|' ',')
  printf '%s\t%s\t%s\n' "$HEADERS_CSV" "$ORDER_ID" "$PAYLOAD" >> "$TMPFILE"
  # Avro path: KEY<TAB>VALUE  (SchemaMessageReader in cp-schema-registry does not honour
  # custom headers.separator / headers.key.separator — produces a parse error)
  printf '%s\t%s\n' "$ORDER_ID" "$PAYLOAD" >> "$TMPFILE_AVRO"

  echo -e "  ${GREEN}[${i}/${COUNT}]${NC} ${ORDER_ID}  ${CUSTOMER}  ${QTY}x ${SKU}  ${EX_CLASS##*.}"
done

# ── produce ───────────────────────────────────────────────────────────────────
echo
echo -e "${YELLOW}Producing to '${TOPIC}'...${NC}"

if [[ "$USE_AVRO" == "true" ]]; then
  # kafka-avro-console-producer lives in the schema-registry container and connects
  # to Kafka via the internal Docker network (INTERNAL listener on kafka:29092).
  # Headers are omitted: SchemaMessageReader ignores custom headers.separator /
  # headers.key.separator properties and the parsing fails with multi-header blocks.
  docker exec -i "$SR_CONTAINER" kafka-avro-console-producer \
    --bootstrap-server "$BROKER_INTERNAL" \
    --topic "$TOPIC" \
    --property schema.registry.url=http://localhost:8081 \
    --property value.schema.id="$SCHEMA_ID" \
    --property key.serializer=org.apache.kafka.common.serialization.StringSerializer \
    --property parse.key=true \
    --property key.separator=$'\t' \
    < "$TMPFILE_AVRO"
else
  docker exec -i "$KAFKA_CONTAINER" kafka-console-producer \
    --bootstrap-server localhost:9092 \
    --topic "$TOPIC" \
    --property parse.key=true \
    --property key.separator=$'\t' \
    --property parse.headers=true \
    --property "headers.key.separator=:" \
    < "$TMPFILE"
fi

echo -e "${GREEN}Done.${NC}  produced=${COUNT}  topic=${TOPIC}"
