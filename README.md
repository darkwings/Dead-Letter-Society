# Dead Letter Society

Web app to monitor Kafka dead-letter queues across multiple clusters. Inspect schema-decoded payloads (Avro / Protobuf / JSON Schema), attach note threads to messages, and replay messages to their original topic.

## Local development

### Option A — Quarkus Dev Services (zero config)

Quarkus auto-starts PostgreSQL and Redpanda via Testcontainers on random ports.
No external services needed, but ports change on every restart — not suitable for
testing cluster connectivity through the DLS UI.

```bash
cd backend
./gradlew quarkusDev

# separate terminal
cd frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:8080

### Option B — docker-compose + fixed ports (recommended for UI testing)

Starts PostgreSQL on 5432 and Redpanda on fixed ports (9092 / 8081).

```bash
# from repo root
docker compose -f docker/docker-compose.dev.yml up -d

cd backend
./gradlew quarkusDev -Dquarkus.devservices.enabled=false

# separate terminal
cd frontend
npm run dev
```

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
