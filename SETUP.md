# Dead Letter Society — Setup Guide

## Prerequisites

- Docker and Docker Compose
- Java 21 (for local development)
- Node.js 20+ (for local development)

---

## Local Development

### 1. Start infrastructure

Redpanda (Kafka-compatible broker + Schema Registry) and PostgreSQL run in Docker. No credentials needed — dev profile uses hardcoded defaults.

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

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

Redpanda ships with `rpk` (Redpanda CLI). Use it to create a topic and publish messages that DLS will ingest.

### Create a DLQ topic

```bash
docker compose -f docker/docker-compose.dev.yml exec redpanda \
  rpk topic create my-service.DLQ --partitions 1
```

### Produce a plain JSON message

```bash
docker compose -f docker/docker-compose.dev.yml exec redpanda \
  rpk topic produce my-service.DLQ --key order-123 <<'EOF'
{"orderId":"order-123","status":"FAILED","reason":"payment_timeout"}
EOF
```

### Produce multiple messages from a file

Create `messages.txt` with one JSON payload per line, then:

```bash
docker compose -f docker/docker-compose.dev.yml exec -T redpanda \
  rpk topic produce my-service.DLQ < messages.txt
```

### Produce with custom headers

```bash
docker compose -f docker/docker-compose.dev.yml exec redpanda \
  rpk topic produce my-service.DLQ \
  --header x-original-topic=my-service.events \
  --header x-correlation-id=abc-123 \
  --key order-123 <<'EOF'
{"orderId":"order-123","status":"FAILED"}
EOF
```

> **Tip:** The `x-original-topic` header is used by the Replay Wizard as the default replay target topic.

### Verify messages landed

```bash
docker compose -f docker/docker-compose.dev.yml exec redpanda \
  rpk topic consume my-service.DLQ --offset start --num 10
```

### Ingest into DLS

1. In DLS, create a cluster pointing to `localhost:9092` (PLAINTEXT).
2. Add a DLQ Config for the topic `my-service.DLQ`.
3. Click **Fetch now** on the messages page to pull the messages in.

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
