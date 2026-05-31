# Dead Letter Society — Setup Guide

## Prerequisites

- Docker and Docker Compose
- Java 21 (for local development)
- Node.js 20+ (for local development)

---

## Local Development

### 1. Start infrastructure

Confluent Kafka (KRaft, PLAINTEXT) and Schema Registry run alongside PostgreSQL in Docker. No credentials needed — dev profile uses hardcoded defaults.

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Services started:
| Container | Port | Purpose |
|---|---|---|
| `dls-dev-kafka` | 9092 | Kafka broker (PLAINTEXT) |
| `dls-dev-schema-registry` | 8081 | Confluent Schema Registry |
| `db` | 5432 | PostgreSQL |

### 2. Start the backend

```bash
cd backend
./gradlew quarkusDev -Dquarkus.devservices.enabled=false
```

Backend starts on `http://localhost:8080`. Hot reload is active — changes recompile on the next request.

### 3. Start the frontend

```bash
cd frontend
npm install   # first time only
npm run dev
```

Frontend starts on `http://localhost:5173` with Vite proxy forwarding `/api/*` to the backend.

### 4. First-run setup

Navigate to `http://localhost:5173/setup` to create the initial admin account.

### Running backend tests

Tests use Quarkus Dev Services (Testcontainers) — no running Docker stack needed:

```bash
cd backend && ./gradlew test
```

### Running E2E tests

Requires the frontend dev server running on port 5173:

```bash
cd frontend && npx playwright test
```

---

## Producing Test Messages to a DLQ

Two helper scripts are available in `scripts/`:

| Script | Purpose |
|---|---|
| `seed-dlq.sh [topic] [count]` | Produce N random order-failure messages (plain JSON or Avro if schema registered) |
| `register-schema.sh [subject] [sr-url]` | Register the matching Avro schema in Schema Registry |

### Quick start

```bash
# Plain JSON — no schema required
./scripts/seed-dlq.sh orders.dlq 20

# Avro — register schema first, then seed
./scripts/register-schema.sh orders.dlq-value
./scripts/seed-dlq.sh orders.dlq 20
```

`seed-dlq.sh` auto-detects whether a schema exists for `<topic>-value` and switches between plain JSON and Avro automatically.

### Manual topic creation

```bash
docker compose -f docker/docker-compose.dev.yml exec dls-dev-kafka \
  kafka-topics --bootstrap-server localhost:9092 \
  --create --topic my-service.dlq --partitions 1 --replication-factor 1
```

### Produce a plain JSON message manually

Each line: `HEADERS<TAB>KEY<TAB>JSON_VALUE` — headers are `|`-separated `key:value` pairs.

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

> **Tip:** The `x-original-topic` header is used by the Replay Wizard as the default replay target topic.

### Consume messages to verify

```bash
docker compose -f docker/docker-compose.dev.yml exec dls-dev-kafka \
  kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic my-service.dlq --from-beginning --max-messages 10 \
  --property print.key=true
```

### Ingest into DLS

1. In DLS, create a cluster pointing to `localhost:9092` (PLAINTEXT, TLS disabled).
2. Add a DLQ Config for topic `my-service.dlq`.
3. Click **Fetch now** on the messages page to pull the messages in.

---

## Producing Schema-Encoded Messages

Schema Registry runs on `http://localhost:8081`. DLS decodes messages using the schema ID embedded in the Confluent wire format (`0x00` + 4-byte schema ID + payload).

Subject naming follows **TopicNameStrategy**: `<topic>-value` for the value schema, `<topic>-key` for the key.

### Using the seed script (recommended)

`register-schema.sh` registers the Order Avro schema used by `seed-dlq.sh`:

```bash
# Register schema for the orders.dlq topic
./scripts/register-schema.sh orders.dlq-value

# seed-dlq.sh automatically switches to Avro when the subject exists
./scripts/seed-dlq.sh orders.dlq 20
```

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

Response returns the schema ID: `{"id":1}`

### Inspect registered schemas

```bash
curl -s http://localhost:8081/subjects
curl -s http://localhost:8081/schemas/ids/1
curl -s http://localhost:8081/subjects/my-service.dlq-value/versions/latest
```

### Produce a schema-encoded message manually

The `dls-dev-schema-registry` container includes `kafka-avro-console-producer` and `kafka-json-schema-console-producer`:

```bash
# Avro
echo '{"orderId":"order-123","status":"FAILED","reason":"payment_timeout"}' | \
  docker compose -f docker/docker-compose.dev.yml exec -T dls-dev-schema-registry \
  kafka-avro-console-producer \
  --bootstrap-server dls-dev-kafka:9092 \
  --topic my-service.dlq \
  --property schema.registry.url=http://localhost:8081 \
  --property value.schema.id=1

# JSON Schema
echo '{"orderId":"order-123","status":"FAILED","reason":"payment_timeout"}' | \
  docker compose -f docker/docker-compose.dev.yml exec -T dls-dev-schema-registry \
  kafka-json-schema-console-producer \
  --bootstrap-server dls-dev-kafka:9092 \
  --topic my-service.dlq \
  --property schema.registry.url=http://localhost:8081 \
  --property value.schema.id=1
```

### Configure DLS to use the Schema Registry

When creating a cluster in DLS, set:
- **Schema Registry URL:** `http://localhost:8081`
- Leave auth fields empty for local dev (no authentication required)

DLS uses the schema ID in each message to fetch and decode the payload via the configured Schema Registry.

---

## SASL/SCRAM Connectivity Test Stack

A separate Docker Compose stack is provided to verify SASL/SCRAM Kafka and Schema Registry basic auth connectivity before integrating with a real authenticated cluster.

### Start the test stack

```bash
docker compose -f docker/docker-compose.sasl-test.yml up -d
```

Services started:
| Container | Port | Credentials |
|---|---|---|
| `dls-sasl-kafka` (EXTERNAL SASL_PLAINTEXT) | 19092 | `admin/admin-secret`, `dls-app/dls-secret` |
| `dls-sasl-schema-registry` (HTTP basic auth) | 18081 | `sr-reader/sr-reader-secret`, `sr-admin/sr-admin-secret` |

Wait ~20 seconds for `kafka-init` to complete user and topic provisioning.

### Verify Kafka SASL auth

```bash
# Requires kcat (kafkacat)
kcat -b localhost:19092 \
     -X security.protocol=SASL_PLAINTEXT \
     -X sasl.mechanism=SCRAM-SHA-256 \
     -X sasl.username=admin -X sasl.password=admin-secret \
     -L
```

### Verify Schema Registry basic auth

```bash
# Should return []
curl -u sr-reader:sr-reader-secret http://localhost:18081/subjects
```

### Run gated connectivity IT tests

```bash
cd backend && ./gradlew test -Dsasl.test.enabled=true \
  --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT"
```

Expected: 6 tests pass — 2 plaintext + 4 SASL/SR gated.

### Stop the test stack

```bash
docker compose -f docker/docker-compose.sasl-test.yml down
```

---

## Building Production Images

Two Dockerfiles are provided — one per service. Both use multi-stage builds so no local JDK or Node is required.

### Backend image

```bash
docker build -t dead-letter-society-backend:latest backend/
```

Build stages:
1. `gradle:8.13-jdk21` — compiles and packages with `./gradlew build -x test`
2. `eclipse-temurin:21-jre-jammy` — copies the Quarkus fast-jar layout (`lib/`, `app/`, `quarkus/`, `quarkus-run.jar`) and runs as non-root uid 185

### Frontend image

```bash
docker build -t dead-letter-society-frontend:latest frontend/
```

Build stages:
1. `node:20-alpine` — runs `npm ci && npm run build`
2. `nginx:1.27-alpine` — serves the static `dist/` and proxies `/api/*` to the backend

The nginx config is generated from `frontend/nginx.conf.template` at container startup via `envsubst`. The backend URL is controlled by the `BACKEND_URL` environment variable (default: `http://backend:8080`).

> **SSE note:** `proxy_buffering off` is set on the `/api/` location so that the real-time event stream works through nginx without delay.

### Running both images with Docker Compose

After building both images, use the production compose file:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Targeting a different backend host (K8s / ECS / Cloud Run)

When the frontend and backend run as separate services, pass the internal service address at runtime:

```bash
# Docker / Docker Compose override
docker run -e BACKEND_URL=http://dls-backend:8080 dead-letter-society-frontend:latest

# Kubernetes — in the frontend Deployment env section
env:
  - name: BACKEND_URL
    value: "http://dls-backend-svc:8080"
```

For Kubernetes clusters with an Ingress controller, a common alternative is to route at the Ingress level (`/api/*` → backend service, `/*` → frontend service) and remove the nginx proxy entirely — both approaches work.

---

## Standalone Mode (no SSO)

Users are managed entirely within the application. The first user to reach the setup screen becomes the admin.

### 1. Generate an encryption key

The encryption key protects Kafka credentials stored in the database. It must be exactly 32 ASCII characters.

```bash
openssl rand -base64 24 | tr -d '=+/' | cut -c1-32
```

### 2. Create a `.env` file

```env
DB_PASSWORD=change-me
DLS_ENCRYPTION_KEY=<32-char key from step 1>
```

### 3. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

The application starts on `http://localhost` (port 80). Navigate there to complete first-run setup and create the admin account.

---

## OIDC Mode — Keycloak

### 1. Create a realm and client

1. Create a realm (e.g. `dls`).
2. Create a client with:
   - **Client ID:** `dls`
   - **Client Protocol:** `openid-connect`
   - **Access Type:** `bearer-only`
3. Create a realm role named `dls-admin`.
4. Assign `dls-admin` to users who should have admin access.

### 2. Configure environment

Add to your `.env`:

```env
OIDC_ENABLED=true
OIDC_SERVER_URL=https://<keycloak-host>/realms/<realm>
OIDC_CLIENT_ID=dls
```

The application maps the `roles` claim to admin status. Any user with the `dls-admin` role in their JWT roles claim becomes an admin; others are provisioned as regular users.

To use a different claim name or value:

```env
DLS_OIDC_ADMIN_CLAIM=<claim-name>   # default: roles
DLS_OIDC_ADMIN_VALUE=<claim-value>  # default: dls-admin
```

### 3. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

## OIDC Mode — Okta

### 1. Create an application

1. In Okta Admin, create an **API Services** application.
2. Note the **Issuer URI** (e.g. `https://<org>.okta.com/oauth2/default`).

### 2. Map groups to roles

Okta does not include group memberships in the default token. Add a custom claim:

1. In your Authorization Server, add a **Groups** claim to the **Access Token**:
   - **Name:** `roles`
   - **Filter:** Matches regex `.*`
2. Assign users who need admin access to a group named `dls-admin`.

### 3. Configure environment

```env
OIDC_ENABLED=true
OIDC_SERVER_URL=https://<org>.okta.com/oauth2/default
OIDC_CLIENT_ID=<client-id>
```

### 4. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

## Encryption Key

The encryption key is used for AES-256-GCM encryption of Kafka credentials (passwords, keystore PEMs) stored in PostgreSQL.

**Requirements:**
- Exactly 32 ASCII characters
- Must never change after clusters have been created (re-keying requires re-entering all credentials)
- Must be treated as a secret — never commit to source control

**Generation:**

```bash
openssl rand -base64 24 | tr -d '=+/' | cut -c1-32
```

---

## Kubernetes Deployment

### Environment variables from a Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dls-secrets
type: Opaque
stringData:
  DB_PASSWORD: "change-me"
  DLS_ENCRYPTION_KEY: "your-32-char-key-here-00000000!!"
```

Reference in the Deployment:

```yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: dls-secrets
        key: DB_PASSWORD
  - name: DLS_ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: dls-secrets
        key: DLS_ENCRYPTION_KEY
```

### Using External Secrets Operator (ESO)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: dls-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend       # your SecretStore name
    kind: SecretStore
  target:
    name: dls-secrets
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: secret/dls
        property: db_password
    - secretKey: DLS_ENCRYPTION_KEY
      remoteRef:
        key: secret/dls
        property: encryption_key
```

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_PASSWORD` | yes | — | PostgreSQL password |
| `DB_USER` | no | `dls` | PostgreSQL username |
| `DB_NAME` | no | `dls` | PostgreSQL database name |
| `DB_HOST` | no | `localhost` | PostgreSQL host |
| `DB_PORT` | no | `5432` | PostgreSQL port |
| `DLS_ENCRYPTION_KEY` | yes | — | 32-char AES key for credential encryption |
| `OIDC_ENABLED` | no | `false` | Enable OIDC authentication |
| `OIDC_SERVER_URL` | OIDC only | — | OIDC issuer URL |
| `OIDC_CLIENT_ID` | OIDC only | `dls` | OIDC client ID |
| `DLS_OIDC_ADMIN_CLAIM` | no | `roles` | JWT claim name to check for admin role |
| `DLS_OIDC_ADMIN_VALUE` | no | `dls-admin` | JWT claim value that grants admin access |
