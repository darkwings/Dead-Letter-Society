# Dead Letter Society

Web app to monitor Kafka dead-letter queues across multiple clusters. Inspect schema-decoded payloads (Avro / Protobuf / JSON Schema), attach note threads to messages, and replay messages to their original topic.

- [Architecture](ARCHITECTURE.md) — hexagonal layers, data flows, component map
- [Setup Guide](SETUP.md) — local dev, Docker images, Kubernetes, environment variables

## Local development

Start the dev stack (PostgreSQL + Redpanda on fixed ports), then run the app:

```bash
# from repo root
docker compose -f docker/docker-compose.dev.yml up -d

cd backend
./gradlew quarkusDev

# separate terminal
cd frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:8080

The backend connects to `localhost:5432` (PostgreSQL) and disables Kafka Dev Services
automatically in `dev` profile — no flags needed.

Cluster config in the DLS UI:
- **Bootstrap servers**: `localhost:9092`
- **Schema Registry URL**: `http://localhost:8081`

### First run

Navigate to http://localhost:5173/setup to create the first admin account.

## Running tests

Unit and integration tests always use Dev Services (Testcontainers) regardless of
which dev option you chose. No external services required.

```bash
cd backend
./gradlew test
```

```bash
cd frontend
npm run test:e2e
```

## Production

See `docker/docker-compose.yml`. Requires:
- `DB_PASSWORD`
- `DLS_ENCRYPTION_KEY` (32+ chars, random)
