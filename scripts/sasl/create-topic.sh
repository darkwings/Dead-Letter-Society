#!/usr/bin/env bash
# Creates a Kafka topic on the SASL test cluster.
# Usage: ./scripts/sasl/create-topic.sh <topic> [partitions] [replication-factor]
#   topic              — required
#   partitions         — default: 1
#   replication-factor — default: 1
#
# Requires the SASL test stack running:
#   docker compose -f docker/docker-compose.sasl-test.yml up -d

set -euo pipefail

TOPIC="${1:-}"
PARTITIONS="${2:-1}"
REPLICATION="${3:-1}"

KAFKA_CONTAINER="dls-sasl-kafka"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

if [[ -z "$TOPIC" ]]; then
  echo -e "${RED}Usage: $0 <topic> [partitions] [replication-factor]${NC}"
  exit 1
fi

if ! [[ "$PARTITIONS" =~ ^[1-9][0-9]*$ ]]; then
  echo -e "${RED}partitions must be a positive integer, got: $PARTITIONS${NC}"; exit 1
fi

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${KAFKA_CONTAINER}$"; then
  echo -e "${RED}Container '${KAFKA_CONTAINER}' not running.${NC}"
  echo "Start the stack:  docker compose -f docker/docker-compose.sasl-test.yml up -d"
  exit 1
fi

echo -e "${YELLOW}Creating topic '${TOPIC}' (partitions=${PARTITIONS}, replication=${REPLICATION})...${NC}"

# Uses INTERNAL (PLAINTEXT) listener — no SASL needed from within the container.
docker exec "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server localhost:9092 \
  --create \
  --if-not-exists \
  --topic "$TOPIC" \
  --partitions "$PARTITIONS" \
  --replication-factor "$REPLICATION"

echo -e "${GREEN}Done.${NC}  topic=${TOPIC}  partitions=${PARTITIONS}  replication=${REPLICATION}"

echo
echo -e "${YELLOW}Topic details:${NC}"
docker exec "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server localhost:9092 \
  --describe \
  --topic "$TOPIC"
