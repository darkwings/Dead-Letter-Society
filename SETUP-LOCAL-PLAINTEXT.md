# Local Development — Plaintext Stack

No-auth local development using Redpanda (Kafka-compatible) and Confluent Schema Registry.
No credentials required. Suitable for feature development and unit/E2E testing.

For authenticated local stacks see:
- [SETUP-LOCAL-SASL.md](SETUP-LOCAL-SASL.md) — SASL/SCRAM Kafka + basic-auth Schema Registry
- [SETUP-LOCAL-TLS.md](SETUP-LOCAL-TLS.md) — SASL_SSL Kafka + HTTPS Schema Registry

## Prerequisites

- Docker and Docker Compose
- Java 21
- Node.js 20+

## Start the stack

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

| Container                  | Port | Purpose                    |
|----------------------------|------|----------------------------|
| `dls-dev-kafka`            | 9092 | Redpanda broker (PLAINTEXT)|
| `dls-dev-schema-registry`  | 8081 | Confluent Schema Registry  |
| `db`                       | 5432 | PostgreSQL                 |

## Start the backend

```bash
cd backend
./gradlew quarkusDev -Dquarkus.devservices.enabled=false
```

Backend starts on `http://localhost:8080`. Hot reload active — changes recompile on next request.

## Start the frontend

```bash
cd frontend
npm install   # first time only
npm run dev
```

Frontend starts on `http://localhost:5173`. Vite proxies `/api/*` to the backend.

## First-run setup

Navigate to `http://localhost:5173/setup` to create the initial admin account.

## Running tests

**Backend** (uses Quarkus Dev Services / Testcontainers — no running stack needed):
```bash
cd backend && ./gradlew test
```

**E2E** (requires frontend dev server on port 5173):
```bash
cd frontend && npx playwright test
```

---

## Scripts

Helper scripts in `scripts/plaintext/` target the dev stack.

### Create a topic

```bash
./scripts/plaintext/create-topic.sh <topic> [partitions] [replication-factor]

# Example
./scripts/plaintext/create-topic.sh orders.dlq 3
```

### Register Avro schemas

Registers `orders.dlq-value` (DLQ) and `orders-value` (source topic) in Schema Registry.

```bash
./scripts/plaintext/register-schema.sh [subject] [sr-url]

# Defaults: subject=orders.dlq-value, sr-url=http://localhost:8081
./scripts/plaintext/register-schema.sh
```

### Seed DLQ messages

```bash
./scripts/plaintext/seed-dlq.sh [--header] [topic] [count]

# Examples
./scripts/plaintext/seed-dlq.sh                        # 20 JSON messages → orders.dlq
./scripts/plaintext/seed-dlq.sh orders.dlq 50
./scripts/plaintext/seed-dlq.sh --header orders.dlq 20 # include SmallRye dead-letter-* headers
```

Auto-detects whether a schema exists for `<topic>-value` and switches between plain JSON and
Confluent Avro wire format accordingly. Run `register-schema.sh` first to get Avro encoding.

---

## Manual Kafka operations

### Produce a plain JSON message

Each line format: `HEADERS<TAB>KEY<TAB>JSON_VALUE` — headers are `|`-separated `key:value` pairs.

```bash
printf 'x-original-topic:my-service.events|x-correlation-id:abc-123\torder-123\t{"orderId":"order-123","status":"FAILED"}\n' | \
  docker compose -f docker/docker-compose.dev.yml exec -T dls-dev-kafka \
  kafka-console-producer --bootstrap-server localhost:9092 \
  --topic my-service.dlq \
  --property parse.key=true \
  --property key.separator=$'\t' \
  --property parse.headers=true \
  --property headers.delimiter=$'\t' \
  --property headers.separator='|' \
  --property headers.key.separator=:
```

> The `x-original-topic` header is used by the Replay Wizard as the default replay target.

### Consume messages to verify

```bash
docker compose -f docker/docker-compose.dev.yml exec dls-dev-kafka \
  kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic my-service.dlq --from-beginning --max-messages 10 \
  --property print.key=true
```

---

## Manual Schema Registry operations

Schema Registry runs on `http://localhost:8081`. No authentication required on the dev stack.

DLS decodes messages using the schema ID embedded in the Confluent wire format
(`0x00` + 4-byte schema ID + payload). Subject naming follows **TopicNameStrategy**:
`<topic>-value` for value schema, `<topic>-key` for key schema.

### Register a schema manually

```bash
# Avro
curl -s -X POST http://localhost:8081/subjects/my-service.dlq-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{
    "schema": "{\"type\":\"record\",\"name\":\"FailedEvent\",\"namespace\":\"com.example\",\"fields\":[{\"name\":\"orderId\",\"type\":\"string\"},{\"name\":\"status\",\"type\":\"string\"},{\"name\":\"reason\",\"type\":\"string\"}]}"
  }'

# JSON Schema
curl -s -X POST http://localhost:8081/subjects/my-service.dlq-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{
    "schemaType": "JSON",
    "schema": "{\"type\":\"object\",\"properties\":{\"orderId\":{\"type\":\"string\"},\"status\":{\"type\":\"string\"},\"reason\":{\"type\":\"string\"}},\"required\":[\"orderId\",\"status\"]}"
  }'
```

### Inspect registered schemas

```bash
curl -s http://localhost:8081/subjects
curl -s http://localhost:8081/schemas/ids/1
curl -s http://localhost:8081/subjects/my-service.dlq-value/versions/latest
```

### Produce an Avro-encoded message manually

The `dls-dev-schema-registry` container includes `kafka-avro-console-producer`:

```bash
echo '{"orderId":"order-123","status":"FAILED","reason":"payment_timeout"}' | \
  docker compose -f docker/docker-compose.dev.yml exec -T dls-dev-schema-registry \
  kafka-avro-console-producer \
  --bootstrap-server dls-dev-kafka:9092 \
  --topic my-service.dlq \
  --property schema.registry.url=http://localhost:8081 \
  --property value.schema.id=1
```

---

## Configure DLS for the local dev cluster

When creating a cluster in DLS:
- **Bootstrap servers:** `localhost:9092`
- **Security protocol:** PLAINTEXT (no TLS, no SASL)
- **Schema Registry URL:** `http://localhost:8081`
- Leave auth fields empty — no authentication on the dev stack

---

## Stop and clean up

```bash
docker compose -f docker/docker-compose.dev.yml down -v
```
