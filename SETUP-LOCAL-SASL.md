# Local SASL Test Stack

Kafka with SCRAM-SHA-256 authentication + Schema Registry with HTTP basic auth.
Runs alongside the dev stack (ports are offset).

## Ports

| Service         | Host port | Protocol        |
|-----------------|-----------|-----------------|
| Kafka (external)| 19092     | SASL_PLAINTEXT  |
| Schema Registry | 18081     | HTTP + basic auth |
| AKHQ UI         | 18085     | HTTP            |

## Credentials

**Kafka (SCRAM-SHA-256):**

| User      | Password      | Role       |
|-----------|---------------|------------|
| `admin`   | `admin-secret`| superuser  |
| `dls-app` | `dls-secret`  | regular    |

**Schema Registry (HTTP basic auth):**

| User        | Password          | Role   |
|-------------|-------------------|--------|
| `sr-admin`  | `sr-admin-secret` | admin  |
| `sr-reader` | `sr-reader-secret`| reader |

## Start the stack

```bash
docker compose -f docker/docker-compose.sasl-test.yml up -d
# Wait ~20s for kafka-init to complete (creates SCRAM users + topics).
```

## Scripts

### Create a topic

```bash
./scripts/sasl/create-topic.sh <topic> [partitions] [replication-factor]

# Example
./scripts/sasl/create-topic.sh orders.dlq 3
```

### Register Avro schemas

Registers two subjects: `orders.dlq-value` (DLQ) and `orders-value` (source topic).

```bash
./scripts/sasl/register-schema.sh [subject] [sr-url]

# Defaults
./scripts/sasl/register-schema.sh
# → subject=orders.dlq-value, sr-url=http://localhost:18081
```

### Seed DLQ messages

```bash
./scripts/sasl/seed-dlq.sh [--header] [topic] [count]

# Examples
./scripts/sasl/seed-dlq.sh                        # 20 JSON messages → orders.dlq
./scripts/sasl/seed-dlq.sh orders.dlq 50          # 50 messages
./scripts/sasl/seed-dlq.sh --header orders.dlq 20 # include SmallRye dead-letter-* headers
```

The script auto-detects whether an Avro schema is registered for `<topic>-value` and switches
between plain JSON and Confluent Avro wire format accordingly.
Run `register-schema.sh` first to get Avro encoding.

## Smoke tests

```bash
# List Kafka topics (requires kcat)
kcat -b localhost:19092 \
     -X security.protocol=SASL_PLAINTEXT \
     -X sasl.mechanism=SCRAM-SHA-256 \
     -X sasl.username=admin -X sasl.password=admin-secret \
     -L

# List SR subjects
curl -u sr-reader:sr-reader-secret http://localhost:18081/subjects
```

## Architecture notes

- The **INTERNAL** listener (`kafka:9092`, PLAINTEXT) is used only within the Docker network
  by kafka-init, Schema Registry, and AKHQ — no SASL needed there.
- The **EXTERNAL** listener (`localhost:19092`, SASL_PLAINTEXT) is what DLS backend tests
  and the scripts on the host connect to.
- All CLI scripts (`create-topic.sh`, `seed-dlq.sh`) use `docker exec` against the
  INTERNAL listener — no SASL config required in the scripts themselves.

## Integration tests

```bash
cd backend && ./gradlew test -Dsasl.test.enabled=true \
  --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT"
```

## Stop and clean up

```bash
docker compose -f docker/docker-compose.sasl-test.yml down -v
```
