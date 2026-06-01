#!/usr/bin/env bash
# Registers an Avro schema in the TLS test stack's Schema Registry (HTTPS + basic auth).
# Usage: ./scripts/tls/register-schema.sh [subject] [sr-url]
#   subject  — default: orders.dlq-value
#   sr-url   — default: https://localhost:28081
#
# Schema Registry credentials (admin role required to register):
#   sr-admin / sr-admin-secret
#
# Requires the TLS test stack running:
#   ./scripts/tls/gen-certs.sh
#   docker compose -f docker/docker-compose.tls-test.yml up -d

set -euo pipefail

SUBJECT="${1:-orders.dlq-value}"
SR_URL="${2:-https://localhost:28081}"

SR_USER="sr-admin"
SR_PASS="sr-admin-secret"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CA_CERT="$(cd "$SCRIPT_DIR/../.." && pwd)/docker/tls-test/certs/ca.crt"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── schema definition ─────────────────────────────────────────────────────────
AVRO_SCHEMA='{
  "type": "record",
  "name": "Order",
  "namespace": "it.dls.domain.order",
  "fields": [
    {"name": "orderId",       "type": "string"},
    {"name": "customerId",    "type": "string"},
    {"name": "item", "type": {
      "type": "record",
      "name": "OrderItem",
      "fields": [
        {"name": "sku",       "type": "string"},
        {"name": "qty",       "type": "int"},
        {"name": "unitPrice", "type": "double"},
        {"name": "currency",  "type": "string"}
      ]
    }},
    {"name": "total",         "type": "double"},
    {"name": "timestamp",     "type": "string"},
    {"name": "correlationId", "type": "string"}
  ]
}'

# ── sanity check ──────────────────────────────────────────────────────────────
if [[ ! -f "$CA_CERT" ]]; then
  echo -e "${RED}CA cert not found: $CA_CERT${NC}"
  echo "Run: ./scripts/tls/gen-certs.sh"
  exit 1
fi

echo -e "${YELLOW}Schema Registry: ${SR_URL} (user: ${SR_USER})${NC}"
if ! curl -sf --cacert "$CA_CERT" -u "${SR_USER}:${SR_PASS}" "${SR_URL}/config" > /dev/null 2>&1; then
  echo -e "${RED}Cannot reach Schema Registry at ${SR_URL}${NC}"
  echo "Check stack is running:  docker compose -f docker/docker-compose.tls-test.yml up -d"
  exit 1
fi

# ── register DLQ subject ──────────────────────────────────────────────────────
echo -e "${YELLOW}Registering subject '${SUBJECT}'...${NC}"

ESCAPED=$(echo "$AVRO_SCHEMA" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))")
BODY="{\"schemaType\":\"AVRO\",\"schema\":${ESCAPED}}"

RESPONSE=$(curl -sf --cacert "$CA_CERT" -u "${SR_USER}:${SR_PASS}" -X POST \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d "$BODY" \
  "${SR_URL}/subjects/${SUBJECT}/versions")

SCHEMA_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

echo -e "${GREEN}Registered.${NC}  subject=${SUBJECT}  schemaId=${SCHEMA_ID}"

# ── register source topic subject ─────────────────────────────────────────────
SOURCE_SUBJECT="orders-value"
echo -e "${YELLOW}Registering subject '${SOURCE_SUBJECT}'...${NC}"

SOURCE_RESPONSE=$(curl -sf --cacert "$CA_CERT" -u "${SR_USER}:${SR_PASS}" -X POST \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d "$BODY" \
  "${SR_URL}/subjects/${SOURCE_SUBJECT}/versions")

SOURCE_SCHEMA_ID=$(echo "$SOURCE_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

echo -e "${GREEN}Registered.${NC}  subject=${SOURCE_SUBJECT}  schemaId=${SOURCE_SCHEMA_ID}"

# ── verify ────────────────────────────────────────────────────────────────────
echo
echo -e "${YELLOW}Registered subjects:${NC}"
curl -sf --cacert "$CA_CERT" -u "${SR_USER}:${SR_PASS}" "${SR_URL}/subjects" \
  | python3 -c "import json,sys; [print(' ', s) for s in json.load(sys.stdin)]"

echo
echo -e "${YELLOW}Schema detail (id=${SCHEMA_ID}):${NC}"
curl -sf --cacert "$CA_CERT" -u "${SR_USER}:${SR_PASS}" "${SR_URL}/schemas/ids/${SCHEMA_ID}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(json.loads(d['schema']), indent=2))"
