# Dead Letter Society — Architecture

## Overview

Dead Letter Society (DLS) is a web application for monitoring, inspecting, and replaying messages in Kafka Dead-Letter Queues. The system follows **hexagonal architecture** (ports and adapters) on the backend and a standard React SPA on the frontend.

---

## High-Level Structure

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  React SPA (Vite + TypeScript + TanStack Query)         │
│  Port 5173 (dev) / 80 (prod via nginx)                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + SSE  /api/*
┌────────────────────────▼────────────────────────────────┐
│  Backend — Quarkus 3.x (JAX-RS, Hibernate Panache)      │
│  Port 8080                                              │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  domain/ │  │ application/ │  │ infrastructure/  │  │
│  │  (pure)  │◄─│  (use cases) │◄─│  (adapters)      │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
└──────┬─────────────────────────────────────┬────────────┘
       │                                     │
┌──────▼──────┐                    ┌─────────▼──────────┐
│  PostgreSQL │                    │  Kafka Cluster(s)  │
│  Port 5432  │                    │  (external)        │
└─────────────┘                    └────────────────────┘
```

---

## Backend — Hexagonal Architecture

### Layer: `domain/`

Pure Java — no framework annotations, no I/O. Contains:

| Package | Contents |
|---|---|
| `domain.cluster` | `KafkaCluster`, `KafkaSecurityConfig`, `SchemaRegistryConfig`, `SchemaRegistryAuthConfig`, `KafkaSecurityProtocol` |
| `domain.dlqconfig` | `DlqConfig`, `DlqRole`, `FetchConfig`, `RetentionPolicy`, `PartitionOffset`, `UserAssignment` |
| `domain.message` | `DlqMessage`, `MessageStatus`, `Note`, `ReplayAuditRecord`, `MessageFilter`, `MessagePage`, repository interfaces |
| `domain.user` | `User`, `GlobalRole`, `AuthProvider`, `UserRepository` |
| `domain.shared` | Port interfaces: `KafkaConsumerPort`, `KafkaProducerPort`, `SchemaRegistryPort`, `EncryptionPort`, `NotificationPort` |

Domain rules:
- All status transitions go through `DlqMessage.transitionTo(MessageStatus)` — no named transition methods
- `KafkaSecurityConfig.decrypted(EncryptionPort)` and `SchemaRegistryAuthConfig.decrypted(EncryptionPort)` produce decrypted copies — decryption stays at the use-case boundary
- `ValidationResult` exposes `.valid()` and `.error()` only — no violations list

### Layer: `application/`

Use cases orchestrate domain objects and call ports. No infrastructure leakage. CDI `@ApplicationScoped`.

| Use case | Responsibility |
|---|---|
| `LoginUseCase` / `OidcLoginUseCase` | Standalone + OIDC authentication, JWT issuance |
| `RegisterAdminUseCase` | First-run admin creation |
| `ManageClusterUseCase` | CRUD for `KafkaCluster`, connectivity test |
| `ManageDlqConfigUseCase` | CRUD for `DlqConfig`, user assignments |
| `FetchMessagesUseCase` | Pull messages from Kafka, decode schema, persist |
| `InspectMessagesUseCase` | List/filter/detail `DlqMessage`, across-DLQ view |
| `AddNoteUseCase` | Append note to message thread |
| `ReplayMessageUseCase` | Single-message replay wizard with schema validation |
| `BulkReplayUseCase` | Batch replay N messages to default replay topic |
| `DashboardUseCase` | Aggregate metrics: status counts, sparkline, DLQ table |
| `RetentionJob` | Purge messages past retention window |

Key invariants:
- Offsets are tracked in the DLS database (`PartitionOffset`), **not** committed to the Kafka broker
- `FetchLockService` uses `ConcurrentHashMap` to prevent concurrent fetches per DLQ config (in-memory, node-local)
- Replay audit records use `@Transactional(TxType.MANDATORY)` — always within the use-case transaction

### Layer: `infrastructure/`

Framework-aware adapters implementing the ports declared in `domain/`.

#### REST API (`infrastructure.api`)

| Resource | Endpoints |
|---|---|
| `AuthResource` | `POST /api/auth/login`, `POST /api/auth/refresh` |
| `SetupResource` | `POST /api/setup` — first admin registration |
| `OidcCallbackResource` | `GET /api/auth/oidc/callback` |
| `ClusterResource` | `GET/POST/PUT/DELETE /api/clusters` |
| `DlqConfigResource` | `GET/POST/PUT/DELETE /api/dlq-configs` |
| `DlqConfigMessagesResource` | `GET/POST /api/dlq-configs/{id}/messages` (list + fetch trigger) |
| `MessageResource` | `GET/PATCH /api/messages/{id}` (detail + status) |
| `AllMessagesResource` | `GET /api/messages` (cross-DLQ list) |
| `NoteResource` | `POST /api/messages/{id}/notes` |
| `ReplayResource` | `POST /api/messages/{id}/replay`, `POST /api/dlq-configs/{id}/replay/bulk` |
| `DashboardResource` | `GET /api/dashboard` |
| `SseResource` | `GET /api/events` — per-user SSE stream |

#### Kafka (`infrastructure.kafka`)

| Adapter | Port |
|---|---|
| `KafkaConsumerAdapter` | `KafkaConsumerPort` — raw `KafkaConsumer` with try-with-resources |
| `KafkaProducerAdapter` | `KafkaProducerPort` — raw `KafkaProducer` |
| `KafkaConnectivityAdapter` | `ConnectivityValidationPort` — `AdminClient` ping |
| `KafkaSecurityPropsBuilder` | Shared helper: builds JAAS + TLS properties for PLAINTEXT / SASL_PLAINTEXT / SASL_SSL |

#### Persistence (`infrastructure.persistence`)

Hibernate ORM Panache entities with Flyway migrations.

| Entity | Maps to |
|---|---|
| `KafkaClusterEntity` | `kafka_clusters` |
| `DlqConfigEntity` | `dlq_configs` |
| `DlqMessageEntity` | `dlq_messages` (JSONB headers + decoded payload) |
| `NoteEntity` | `notes` |
| `PartitionOffsetEntity` | `partition_offsets` |
| `ReplayAuditRecordEntity` | `replay_audit_records` |
| `UserEntity` | `users` |

Migration versions: V1 (schema) → V2 (users) → V3 (clusters/configs) → V4 (messages/offsets) → V5 (notes) → V6 (replay audit + default replay topic) → V7 (tls_enabled on clusters).

#### Other adapters

| Adapter | Port |
|---|---|
| `AesGcmEncryptionAdapter` | `EncryptionPort` — AES-256-GCM, key from `DLS_ENCRYPTION_KEY` env var |
| `BcryptPasswordHashAdapter` | `PasswordHashPort` |
| `SseNotificationAdapter` | `NotificationPort` — broadcasts `MessageStatusChanged` events to SSE streams |
| `ConfluentSchemaRegistryAdapter` | `SchemaRegistryPort` — decodes Avro + JSON Schema via Confluent wire format |
| `JsonSchemaRegistryAdapter` | `SchemaRegistryPort` — JSON Schema-only path |

---

## Frontend — React SPA

```
src/
├── pages/           — one directory per feature area
│   ├── clusters/    — ClusterListPage, CreateClusterPage
│   ├── dlqconfig/   — DlqConfigListPage, Create/EditDlqConfigPage
│   ├── messages/    — MessageListPage, MessageDetailPage, AllMessagesPage, ReplayWizard
│   ├── dashboard/   — DashboardPage (ADMIN only)
│   ├── admin/       — UsersPage (ADMIN only)
│   └── settings/    — SettingsGeneralPage
├── components/      — shared components (AdminGuard, NoteThread, …)
├── stores/          — Zustand: authStore (JWT + user, persisted to localStorage)
└── lib/
    └── api.ts       — single apiFetch<T> wrapper; no generated OpenAPI client
```

Data fetching uses **TanStack Query** throughout. Types are hand-written interfaces co-located with each page — no generated OpenAPI client.

SSE: `NoteThread` and `MessageDetailPage` open an `EventSource` against `GET /api/events`. The connection is user-scoped; the server filters events by DLQ config assignment.

Auth: JWT stored in Zustand + `localStorage`. `AdminGuard` wraps admin-only routes and redirects non-admins to `/messages`.

---

## Security

- Kafka credentials (password, keystore PEM) are encrypted with AES-256-GCM before being stored in PostgreSQL. The key is `DLS_ENCRYPTION_KEY` (32 ASCII chars, required at startup).
- Decryption happens at the use-case boundary just before calling Kafka ports — encrypted field names in `KafkaSecurityConfig` are prefixed with `encrypted*` as a reminder.
- JWTs are signed with a server-generated key. OIDC mode delegates token validation to the configured provider; the `roles` claim (configurable) determines admin status.

---

## Data Flow: Message Ingestion

```
Scheduler (every N min)          User clicks "Fetch now"
        │                                  │
        └──────────► FetchMessagesUseCase ◄┘
                              │
                    KafkaConsumerPort
                  (KafkaConsumerAdapter)
                              │
                    raw KafkaConsumer poll
                              │
                   SchemaRegistryPort (optional)
                   decode Avro / JSON Schema
                              │
                    MessageRepository.save()
                    PartitionOffset.update()
                              │
                    NotificationPort.emitFetchCompleted()
                              │
                    SSE → connected browser tabs
```

---

## Data Flow: Replay

```
User confirms replay in ReplayWizard
        │
ReplayMessageUseCase
        ├── schema validation (SchemaRegistryPort, optional)
        ├── KafkaProducerPort.send(target topic, payload, headers)
        ├── DlqMessage.transitionTo(REPLAYED)
        └── ReplayAuditRecord (insert-only, TxType.MANDATORY)
        │
NotificationPort.emitMessageStatusChanged(messageId, dlqConfigId, newStatus)
        │
SSE → connected browser tabs
```

---

## Deployment

Two Docker images, each multi-stage:

| Image | Build stage | Runtime stage |
|---|---|---|
| `dead-letter-society-backend` | `eclipse-temurin:21-jdk-jammy` + `./gradlew build` | `eclipse-temurin:21-jre-jammy`, non-root uid 185 |
| `dead-letter-society-frontend` | `node:22-alpine` + `npm run build` | `nginx:1.27-alpine` with `envsubst` template |

The nginx config is generated from `frontend/nginx.conf.template` at container startup. `BACKEND_URL` (default `http://backend:8080`) controls the upstream for `/api/*` proxy. `proxy_buffering off` is set on `/api/` so SSE streams reach the browser without delay.

See [SETUP.md](SETUP.md) for local development, production compose, and Kubernetes deployment instructions.
