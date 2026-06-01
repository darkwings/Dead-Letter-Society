# Dead Letter Society

Web app to monitor Kafka dead-letter queues across multiple clusters. Inspect schema-decoded payloads (Avro / Protobuf / JSON Schema), attach note threads to messages, and replay messages to their original topic.

## Documentation

| File | Audience | Purpose |
|------|----------|---------|
| [SETUP.md](SETUP.md) | **Operators / SRE** | Production deployment: Docker images, standalone and OIDC auth, Kubernetes, environment variables |
| [SETUP-LOCAL-PLAINTEXT.md](SETUP-LOCAL-PLAINTEXT.md) | **Developers** | Local dev with no auth (Redpanda + plain Schema Registry) — start here for feature development |
| [SETUP-LOCAL-SASL.md](SETUP-LOCAL-SASL.md) | **Developers** | Local stack with SASL/SCRAM Kafka + basic-auth Schema Registry — test authenticated cluster config |
| [SETUP-LOCAL-TLS.md](SETUP-LOCAL-TLS.md) | **Developers** | Local stack with SASL_SSL Kafka + HTTPS Schema Registry — test TLS cert handling end-to-end |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Developers** | Hexagonal layers, data flows, component map |

## Quick start (local dev)

```bash
docker compose -f docker/docker-compose.dev.yml up -d

cd backend && ./gradlew quarkusDev

# separate terminal
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:5173 — navigate to `/setup` on first run to create the admin account.  
Backend: http://localhost:8080

See [SETUP-LOCAL-PLAINTEXT.md](SETUP-LOCAL-PLAINTEXT.md) for scripts, manual Kafka operations,
and Schema Registry usage.

## Running tests

```bash
# Backend — uses Testcontainers, no running stack needed
cd backend && ./gradlew test

# E2E — requires frontend dev server on :5173
cd frontend && npx playwright test
```

## Production

See [SETUP.md](SETUP.md). Minimum required environment variables:

```env
DB_PASSWORD=...
DLS_ENCRYPTION_KEY=...   # exactly 32 ASCII chars, generated once, never changed
```
