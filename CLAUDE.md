# DEAD LETTER SOCIETY

Web application to monitor Kafka dead-letter queues across multiple clusters. Inspect schema-decoded payloads (Avro / Protobuf / JSON Schema via Confluent or Apicurio Schema Registry), attach internal note threads to messages, and replay messages to their original topic through a guarded wizard. Multi-cluster, multi-tenant (teams × DLQs × roles), with both standalone and OIDC-federated auth.

Domain is described by [DOMAIN.md](DOMAIN.md).
The language of this bounded context is described by [TERMS.md](TERMS.md).
Every feature should be tested thoroughly per [EVALUATION.md](EVALUATION.md).

## Architecture

**Hexagonal architecture** (ports-and-adapters) throughout:
- `domain/` — pure domain objects, repository/service ports, no framework dependencies
- `application/` — use cases, inject ports via CDI `@Inject`
- `infrastructure/` — Panache entities, Kafka adapters, REST resources

Backend: Quarkus 3.x (JAX-RS, Hibernate ORM Panache, SmallRye JWT, Flyway). PostgreSQL with JSONB for headers/decoded payloads.
Frontend: React + Vite + TypeScript, TanStack Query, Zustand auth store, Tailwind + shadcn/ui components, Playwright E2E.

## Codebase Conventions

**Use case injection:** `FetchMessagesUseCase` uses constructor injection; newer use cases (`InspectMessagesUseCase`, `ReplayMessageUseCase`) use field injection via `@Inject`. Both patterns coexist.

**Security config:** `KafkaSecurityConfig` fields are named `encrypted*` even when decrypted at the port boundary. Decryption (AES-256-GCM via `EncryptionPort`) happens in the use case before calling Kafka ports.

**Kafka adapters:** No reactive messaging channels. All Kafka operations use raw `AdminClient` / `KafkaConsumer` / `KafkaProducer` with explicit `try-with-resources`. `buildBaseProps` is duplicated across `KafkaConsumerAdapter`, `KafkaConnectivityAdapter`, and `KafkaProducerAdapter` — intentional given each adapter has different config needs.

**Notifications:** `NotificationPort.emitMessageStatusChanged(messageId, dlqConfigId, newStatus)` takes 3 args including `dlqConfigId` for SSE per-user filtering.

**E2E tests:** All tests navigating to `MessageDetailPage` must mock `/api/events` (SSE) because `NoteThread` opens `EventSource` unconditionally. Use `loginAsAdmin/Operator/Viewer` from `e2e/helpers/auth.ts` (Zustand localStorage injection).

**Stateful E2E mocks:** Use closure variables (`let currentStatus = 'NEW'`) inside `page.route` for mutation tests, not `page.unroute` + re-route.

**`ValidationResult`:** `.valid()` (boolean) and `.error()` (single string) — no `violations()` list.

**`DlqMessage` status change:** Always use `msg.transitionTo(MessageStatus.X)` — no named methods like `markReplayed()`.

**`DlqMessage.getKey()`** — not `getMessageKey()`.

**Schema Registry:** `SchemaRegistryPort.validate()` takes `int schemaId` (primitive). Cluster's SR is nullable; always null-check `cluster.getSchemaRegistry()` before use.

**Frontend API client:** Single `apiFetch<T>` in `src/lib/api.ts`. No generated OpenAPI client. Types are hand-written interfaces co-located with each page.

## Current Implementation Status

**Branch:** `phase-0-foundation`

| Phase | Status | Summary |
|-------|--------|---------|
| 0 — Foundation | ✅ | Backend + frontend scaffold, Docker Compose |
| 1 — Identity & Access | ✅ | Users, JWT auth, OIDC |
| 2 — Cluster Management | ✅ | KafkaCluster, DlqConfig CRUD |
| 3 — Message Ingestion | ✅ | KafkaConsumer, schema decode, SSE |
| 4 — Message Inspection | ✅ | List/filter/detail, status transitions |
| 5 — Note Thread | ✅ | Notes with SSE real-time broadcast |
| 6 — Replay | ✅ | ReplayWizard, KafkaProducerPort, audit records |
| 7 — Retention & SSE Frontend | pending | |

## Key Technical Decisions

- Offsets tracked in DB, NOT committed to Kafka broker (FETCH-001)
- Confluent Protobuf decode disabled (`@Disabled`) — binary incompatibility with protobuf-java 4.x (Quarkus BOM). Re-enable on Confluent 8.x upgrade.
- `quarkus.hibernate-orm.mapping.format.global=ignore` required for JSONB + `write-dates-as-timestamps=false` coexistence
- `DlqUserAssignmentEntity` uses `@IdClass` composite key
- `FetchLockService` uses `ConcurrentHashMap.newKeySet()` (in-memory, node-local)
- `author_display_name` denormalized on notes (avoids JOIN)
- Notes are immutable insert-only records
- Redpanda (not Confluent cp-kafka) in `docker-compose.dev.yml`
- Replay audit records: insert-only, `TxType.MANDATORY` (always within use case transaction)
- `DlqConfig.defaultReplayTopic` added in V6 migration for configurable replay topic default

## Flyway Migrations

| Version | Description |
|---------|-------------|
| V1 | Initial schema |
| V2 | Users table |
| V3 | kafka_clusters + dlq_configs |
| V4 | dlq_messages + partition_offsets |
| V5 | notes |
| V6 | replay_audit_records + default_replay_topic on dlq_configs |

## Running Locally

```bash
# Backend (requires Docker for Postgres + Redpanda)
docker compose -f docker-compose.dev.yml up -d
cd backend && ./gradlew quarkusDev

# Frontend
cd frontend && npm run dev

# Backend tests
cd backend && ./gradlew test

# E2E tests (requires frontend running on :5173)
cd frontend && npx playwright test
```
