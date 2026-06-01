# Local TLS Test Stack

Kafka with SCRAM-SHA-256 over TLS (SASL_SSL) + Schema Registry with HTTPS and HTTP basic auth.
Runs alongside the dev and SASL stacks (ports are offset).

## Ports

| Service          | Host port | Protocol             |
|------------------|-----------|----------------------|
| Kafka (external) | 29092     | SASL_SSL             |
| Schema Registry  | 28081     | HTTPS + basic auth   |
| AKHQ UI          | 28085     | HTTP                 |

## Credentials

**Kafka (SCRAM-SHA-256 over TLS):**

| User      | Password      | Role       |
|-----------|---------------|------------|
| `admin`   | `admin-secret`| superuser  |
| `dls-app` | `dls-secret`  | regular    |

**Schema Registry (HTTPS + basic auth):**

| User        | Password          | Role   |
|-------------|-------------------|--------|
| `sr-admin`  | `sr-admin-secret` | admin  |
| `sr-reader` | `sr-reader-secret`| reader |

**TLS (all keystores):** password `changeit`

## One-time setup: generate certificates

```bash
./scripts/tls/gen-certs.sh
```

This generates a local CA and server certificates using **openssl** only — no `keytool` required.
Output goes to `docker/tls-test/certs/` (gitignored). Re-run with `--force` to regenerate.

**What gets generated:**

| File                    | Purpose                                               |
|-------------------------|-------------------------------------------------------|
| `ca.key` / `ca.crt`     | Local CA — used to sign all certs                     |
| `broker.key` / `broker.crt` | Kafka broker cert (SAN: `kafka`, `localhost`, `127.0.0.1`) |
| `broker.keystore.p12`   | PKCS12 keystore for Kafka broker                      |
| `truststore.p12`        | PKCS12 truststore (CA cert only) — shared by all clients |
| `sr.key` / `sr.crt`     | Schema Registry cert (SAN: `schema-registry`, `localhost`, `127.0.0.1`) |
| `sr.keystore.p12`       | PKCS12 keystore for Schema Registry                   |

## Start the stack

```bash
./scripts/tls/gen-certs.sh   # skip if already done
docker compose -f docker/docker-compose.tls-test.yml up -d
# Wait ~20s for kafka-init to complete (creates SCRAM users + topics).
```

## Scripts

### Create a topic

```bash
./scripts/tls/create-topic.sh <topic> [partitions] [replication-factor]

# Example
./scripts/tls/create-topic.sh orders.dlq 3
```

### Register Avro schemas

Registers two subjects: `orders.dlq-value` (DLQ) and `orders-value` (source topic).
Uses HTTPS with CA cert verification — no `-k` / insecure mode.

```bash
./scripts/tls/register-schema.sh [subject] [sr-url]

# Defaults
./scripts/tls/register-schema.sh
# → subject=orders.dlq-value, sr-url=https://localhost:28081
```

### Seed DLQ messages

```bash
./scripts/tls/seed-dlq.sh [--header] [topic] [count]

# Examples
./scripts/tls/seed-dlq.sh                        # 20 JSON messages → orders.dlq
./scripts/tls/seed-dlq.sh orders.dlq 50          # 50 messages
./scripts/tls/seed-dlq.sh --header orders.dlq 20 # include SmallRye dead-letter-* headers
```

Schema auto-detection queries SR via HTTPS from the host (`ca.crt` used for verification).
Run `register-schema.sh` first to get Avro encoding.

## Smoke tests

```bash
# List Kafka topics (requires kcat)
kcat -b localhost:29092 \
     -X security.protocol=SASL_SSL \
     -X sasl.mechanism=SCRAM-SHA-256 \
     -X sasl.username=admin -X sasl.password=admin-secret \
     -X ssl.ca.location=docker/tls-test/certs/ca.crt \
     -L

# List SR subjects via HTTPS
curl --cacert docker/tls-test/certs/ca.crt \
     -u sr-reader:sr-reader-secret \
     https://localhost:28081/subjects

# Verify TLS cert presented by SR
openssl s_client -connect localhost:28081 \
  -CAfile docker/tls-test/certs/ca.crt \
  -showcerts </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

## Architecture notes

### Listener layout

```
External clients (host)
  └── localhost:29092  SASL_SSL  ──► Kafka EXTERNAL listener
                                     (SCRAM-SHA-256 + TLS, broker.keystore.p12)

Docker-internal traffic (kafka-init, SR, AKHQ)
  └── kafka:9092       PLAINTEXT ──► Kafka INTERNAL listener
                                     (no auth, no TLS — not exposed outside Docker)

External clients (host)
  └── localhost:28081  HTTPS     ──► SR https://0.0.0.0:8443
                                     (sr.keystore.p12)

Docker-internal traffic (AKHQ, kafka-avro-console-producer)
  └── schema-registry:8081  HTTP ──► SR http://0.0.0.0:8081
                                     (no TLS — not exposed outside Docker)
```

### Why no TLS inside Docker network

All intra-container traffic uses the INTERNAL PLAINTEXT Kafka listener and the SR HTTP listener.
TLS would add cert-distribution complexity with no security benefit in an isolated Docker network.
The SASL_SSL and HTTPS endpoints are there to test that DLS backend handles them correctly —
not to secure the test environment itself.

### Client trust configuration

Any client connecting from the **host** (Java app, kcat, curl) must trust the local CA:

**curl:**
```bash
curl --cacert docker/tls-test/certs/ca.crt ...
```

**kcat:**
```
-X ssl.ca.location=docker/tls-test/certs/ca.crt
```

**Java / Quarkus application:**
```properties
# application-tls-test.properties
kafka.security.protocol=SASL_SSL
kafka.sasl.mechanism=SCRAM-SHA-256
kafka.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="dls-app" password="dls-secret";
kafka.ssl.truststore.location=docker/tls-test/certs/truststore.p12
kafka.ssl.truststore.password=changeit
kafka.ssl.truststore.type=PKCS12

schema.registry.url=https://localhost:28081
schema.registry.ssl.truststore.location=docker/tls-test/certs/truststore.p12
schema.registry.ssl.truststore.password=changeit
schema.registry.ssl.truststore.type=PKCS12
schema.registry.basic.auth.credentials.source=USER_INFO
schema.registry.basic.auth.user.info=sr-reader:sr-reader-secret
```

## Integration tests

```bash
cd backend && ./gradlew test -Dtls.test.enabled=true \
  --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT"
```

## Regenerate certificates

Certs expire after 10 years. To regenerate early:
```bash
./scripts/tls/gen-certs.sh --force
docker compose -f docker/docker-compose.tls-test.yml restart
```

## Stop and clean up

```bash
docker compose -f docker/docker-compose.tls-test.yml down -v
```
