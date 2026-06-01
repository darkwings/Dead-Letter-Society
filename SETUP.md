# Dead Letter Society — Operator Guide

Dead Letter Society (DLS) is a multi-cluster, multi-tenant Kafka dead-letter queue monitor.
Operators can inspect schema-decoded payloads, annotate messages with note threads, and replay
messages to their origin topic through a guarded wizard.

> **Local development?** See the dev setup docs instead:
> [SETUP-LOCAL-PLAINTEXT.md](SETUP-LOCAL-PLAINTEXT.md) · [SETUP-LOCAL-SASL.md](SETUP-LOCAL-SASL.md) · [SETUP-LOCAL-TLS.md](SETUP-LOCAL-TLS.md)

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A running PostgreSQL 15+ instance (or use the bundled Compose service)
- Outbound network access from DLS backend to your Kafka brokers and Schema Registry

---

## Build the images

Two Dockerfiles are provided, one per service. Both use multi-stage builds — no local JDK or
Node installation required on the build host.

### Backend

```bash
docker build -t dead-letter-society-backend:latest backend/
```

Stages:
1. `gradle:8.13-jdk21` — compiles and packages via `./gradlew build -x test`
2. `eclipse-temurin:21-jre-jammy` — runs the Quarkus fast-jar as non-root uid 185

### Frontend

```bash
docker build -t dead-letter-society-frontend:latest frontend/
```

Stages:
1. `node:20-alpine` — `npm ci && npm run build`
2. `nginx:1.27-alpine` — serves the static `dist/` and reverse-proxies `/api/*` to the backend

The nginx backend target is controlled by `BACKEND_URL` at container start (see
[Environment variables](#environment-variable-reference)). `proxy_buffering off` is set on
`/api/` so that SSE streams pass through without delay.

---

## Configuration

### Generate an encryption key

DLS encrypts Kafka credentials (passwords, keystore PEMs) in PostgreSQL using AES-256-GCM.
The key must be **exactly 32 ASCII characters** and must never change after clusters are created
(there is no re-keying path — you would need to re-enter all cluster credentials).

```bash
openssl rand -base64 24 | tr -d '=+/' | cut -c1-32
```

Store the result in a secret manager. Never commit it to source control.

### Create a `.env` file

```env
# Required
DB_PASSWORD=change-me
DLS_ENCRYPTION_KEY=<32-char key from above>

# Optional overrides (see full reference below)
# DB_USER=dls
# DB_NAME=dls
# DB_HOST=db
# DB_PORT=5432
```

---

## Authentication modes

### Standalone mode (built-in user management)

No external identity provider required. The first user to reach the setup screen becomes the admin.

Set `OIDC_ENABLED=false` (default) and start the stack:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Navigate to `http://<host>` to complete first-run setup.

---

### OIDC mode — Keycloak

#### 1. Create a realm and client

1. Create a realm (e.g. `dls`).
2. Create a client:
   - **Client ID:** `dls`
   - **Client Protocol:** `openid-connect`
   - **Access Type:** `bearer-only`
3. Create a realm role named `dls-admin`.
4. Assign `dls-admin` to users who need admin access.

#### 2. Add to `.env`

```env
OIDC_ENABLED=true
OIDC_SERVER_URL=https://<keycloak-host>/realms/<realm>
OIDC_CLIENT_ID=dls
```

DLS maps the `roles` JWT claim to admin status. Users with `dls-admin` in their roles become
admins; all others are provisioned as regular users. To override the claim name or value:

```env
DLS_OIDC_ADMIN_CLAIM=<claim-name>   # default: roles
DLS_OIDC_ADMIN_VALUE=<claim-value>  # default: dls-admin
```

#### 3. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

### OIDC mode — Okta

#### 1. Create an application

Create an **API Services** application in Okta Admin. Note the **Issuer URI**
(e.g. `https://<org>.okta.com/oauth2/default`).

#### 2. Map groups to roles

Okta does not include group memberships in the default token. Add a custom claim:

1. In your Authorization Server, add a **Groups** claim to the **Access Token**:
   - **Name:** `roles`
   - **Filter:** Matches regex `.*`
2. Assign users who need admin access to a group named `dls-admin`.

#### 3. Add to `.env`

```env
OIDC_ENABLED=true
OIDC_SERVER_URL=https://<org>.okta.com/oauth2/default
OIDC_CLIENT_ID=<client-id>
```

#### 4. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

## Kubernetes deployment

### Secrets

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

Reference in the backend Deployment:

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

### External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: dls-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
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

### Frontend backend URL

When frontend and backend run as separate services, pass the internal service address:

```yaml
# Frontend Deployment env
env:
  - name: BACKEND_URL
    value: "http://dls-backend-svc:8080"
```

Alternatively, route at the Ingress level (`/api/*` → backend service, `/*` → frontend service)
and remove the nginx proxy entirely.

---

## Environment variable reference

| Variable               | Required     | Default     | Description |
|------------------------|--------------|-------------|-------------|
| `DB_PASSWORD`          | yes          | —           | PostgreSQL password |
| `DB_USER`              | no           | `dls`       | PostgreSQL username |
| `DB_NAME`              | no           | `dls`       | PostgreSQL database name |
| `DB_HOST`              | no           | `localhost` | PostgreSQL host |
| `DB_PORT`              | no           | `5432`      | PostgreSQL port |
| `DLS_ENCRYPTION_KEY`   | yes          | —           | 32-char AES-256-GCM key for credential encryption |
| `BACKEND_URL`          | frontend only| `http://backend:8080` | Backend address used by nginx reverse proxy |
| `OIDC_ENABLED`         | no           | `false`     | Enable OIDC authentication |
| `OIDC_SERVER_URL`      | OIDC only    | —           | OIDC issuer URL |
| `OIDC_CLIENT_ID`       | OIDC only    | `dls`       | OIDC client ID |
| `DLS_OIDC_ADMIN_CLAIM` | no           | `roles`     | JWT claim name checked for admin role |
| `DLS_OIDC_ADMIN_VALUE` | no           | `dls-admin` | JWT claim value that grants admin access |
