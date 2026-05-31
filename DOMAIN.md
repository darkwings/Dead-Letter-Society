# DOMAIN.md — Dead Letter Society

## Overview

**UI Language:** English only. No internationalization (i18n) planned.

Dead Letter Society (DLS) is an operational web application for monitoring, inspecting, and replaying messages in Kafka Dead Letter Queues (DLQs). It supports multi-cluster setups, standalone and OIDC authentication, schema decoding, collaborative annotation, and guided replay with schema validation.

---

## Bounded Contexts

### 1. Cluster Management
Management of Kafka cluster configurations and their associated DLQs. ADMIN responsibility.

**Contains:**
- Registration and configuration of `KafkaCluster`
- `SchemaRegistry` configuration (one per cluster)
- Creation and management of `DlqConfig`
- Editing of `DlqConfig` (all fields except `topicName`, which is immutable after creation)
- Topic Browser: live enumeration of available topics on a Kafka Cluster to assist in `topicName` selection
- Assignment of users to `DlqConfig` with roles

### 2. Identity & Access
User management, authentication (standalone/OIDC), and authorization (global and per-DLQ roles).

**Contains:**
- `User` registration and management
- Local authentication (username/password)
- OIDC federation (claim → ADMIN role mapping)
- `VIEWER`/`OPERATOR` role assignment per DLQ config

### 3. Message Ingestion
Download of messages from Kafka DLQs into the application database. Offset management, scheduling, and on-demand fetch.

**Contains:**
- Fetch execution (scheduled/on-demand)
- `PartitionOffset` management for each (DlqConfig × partition) pair
- Partition reconciliation
- Schema decoding (Avro / Protobuf / JSON Schema via Confluent Schema Registry)
- Deduplication by offset

### 4. Message Inspection
Inspection, filtering, and annotation of downloaded messages.

**Contains:**
- `DlqMessage` list and detail view per DLQ Config
- **All Messages view** — cross-DLQ list filtered by status only (accessible to all authenticated users)
- Filters (status, timestamp, partition, offset range)
- `NoteThread` — comment thread per message
- Ticket Reference (manual reference to an external system)
- In-app notifications via SSE on fetch completion

### 5. Replay
Guided resubmission of a message to its original topic, with optional schema validation and payload editing.

**Contains:**
- Replay wizard (multi-step, UI confirmation) — for a single message
- **Bulk Replay** — simplified replay of N selected messages to the Default Replay Topic of the DLQ Config, without payload editing or wizard
- Decoded payload editing with schema validation (OPERATOR only, single message)
- Target topic resolution (header → explicit override)
- Kafka publish with tracking headers added
- `ReplayAuditRecord` — immutable, includes `replayedBy` (userId)
- Message status transitions

### 6. Dashboard & Analytics *(ADMIN only)*
Operational panel with aggregate metrics across the entire system.

**Contains:**
- **Summary Cards** — message counts by status (NEW, UNDER_REVIEW, REPLAYED, DISCARDED, REPLAY_FAILED) across all DLQ Configs
- **Replay Rate Sparkline** — percentage of replayed messages out of total, daily granularity, 7-day window
- **DLQ Status Table** — per DLQ Config: NEW count, last fetch timestamp, link to message list
- Accessible exclusively to ADMINs; other roles see the cluster list as home

---

## Aggregates & Entities

### `KafkaCluster` *(Aggregate Root)*
Represents a monitored Kafka cluster.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `name` | String | human-readable name |
| `bootstrapServers` | String | `host:port,...` |
| `securityConfig` | `KafkaSecurityConfig` | value object |
| `schemaRegistry` | `SchemaRegistryConfig` | embedded entity, one per cluster |
| `dlqConfigs` | List\<DlqConfig\> | |

### `SchemaRegistryConfig` *(Entity)*
Configuration of the Confluent Schema Registry associated with the cluster.

| Field | Type | Notes |
|-------|------|-------|
| `url` | String | |
| `authConfig` | `SchemaRegistryAuthConfig` | optional credentials |

### `DlqConfig` *(Aggregate Root)*
Configuration for monitoring a DLQ topic on a cluster.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `clusterId` | UUID | FK → KafkaCluster |
| `topicName` | String | DLQ topic name |
| `displayName` | String | UI name |
| `fetchConfig` | `FetchConfig` | mode, cron, batchSize |
| `retentionPolicy` | `RetentionPolicy` | days or maxCount |
| `defaultReplayTopic` | String? | explicit replay topic override |
| `userAssignments` | List\<UserAssignment\> | User × Role |
| `partitionOffsets` | List\<PartitionOffset\> | fetch state per partition |

### `FetchConfig` *(Value Object)*

| Field | Type | Notes |
|-------|------|-------|
| `mode` | `DownloadMode` | SCHEDULED / ON_DEMAND / BOTH |
| `cronExpression` | String? | required if SCHEDULED or BOTH |
| `batchSize` | Int | default 500 |

### `PartitionOffset` *(Value Object)*

| Field | Type | Notes |
|-------|------|-------|
| `partition` | Int | |
| `lastOffset` | Long | -1 = not yet fetched (earliest) |
| `status` | `PartitionStatus` | ACTIVE / INACTIVE |
| `updatedAt` | Instant | |

### `UserAssignment` *(Value Object)*

| Field | Type | Notes |
|-------|------|-------|
| `userId` | UUID | |
| `role` | `DlqRole` | VIEWER / OPERATOR |

### `DlqMessage` *(Aggregate Root)*
A message downloaded from a DLQ and persisted in the database.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `dlqConfigId` | UUID | FK → DlqConfig |
| `partition` | Int | |
| `offset` | Long | |
| `timestamp` | Instant | Kafka timestamp |
| `messageKey` | Bytes? | raw Kafka key |
| `rawPayload` | Bytes | raw payload |
| `decodedPayload` | JsonNode? | payload decoded via schema |
| `schemaId` | Int? | schema ID in the registry |
| `headers` | Map\<String,String\> | original Kafka headers |
| `status` | `MessageStatus` | lifecycle |
| `noteThread` | `NoteThread` | embedded |
| `replayAudit` | `ReplayAuditRecord`? | present if replay was executed |
| `ingestedAt` | Instant | DB insertion timestamp |

### `NoteThread` *(Entity embedded in DlqMessage)*
Comment thread associated with a message.

| Field | Type |
|-------|------|
| `notes` | List\<Note\> |

### `Note` *(Entity)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `authorId` | UUID | |
| `content` | String | free text |
| `ticketReference` | String? | e.g. "JIRA-1234" |
| `createdAt` | Instant | |

### `ReplayAuditRecord` *(Value Object embedded in DlqMessage)*

| Field | Type | Notes |
|-------|------|-------|
| `replayedBy` | UUID | userId |
| `replayedAt` | Instant | |
| `targetTopic` | String | topic the message was published to |
| `payloadEdited` | Boolean | true if payload was modified before replay |
| `failureReason` | String? | present if REPLAY_FAILED |
| `attemptCount` | Int | number of attempts (including retries) |

### `User` *(Aggregate Root)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `email` | String | |
| `displayName` | String | |
| `authProvider` | `AuthProvider` | LOCAL / OIDC |
| `globalRole` | `GlobalRole` | ADMIN / USER |
| `passwordHash` | String? | LOCAL only |
| `oidcSubject` | String? | OIDC only |

---

## Value Objects — Enumerations

### `MessageStatus`
```
NEW → UNDER_REVIEW → REPLAYED
                   ↘ DISCARDED
                   ↘ REPLAY_FAILED ⟳ retry → UNDER_REVIEW
```

### `DownloadMode`
`SCHEDULED` | `ON_DEMAND` | `BOTH`

### `DlqRole` (per-DLQ-config role)
`VIEWER` | `OPERATOR`

### `GlobalRole`
`ADMIN` | `USER`

### `AuthProvider`
`LOCAL` | `OIDC`

### `KafkaSecurityProtocol`
`PLAINTEXT` | `SASL_PLAIN` | `SASL_SCRAM_SHA_256` | `SASL_SCRAM_SHA_512` | `SSL`

---

## Domain Events

| Event | Trigger | Key Payload |
|-------|---------|-------------|
| `KafkaClusterRegistered` | Admin registers a cluster | clusterId |
| `DlqConfigCreated` | Admin creates a DLQ config | dlqConfigId, clusterId |
| `FetchCompleted` | Fetch ends (scheduled/on-demand) | dlqConfigId, count, latestOffsets |
| `FetchSkipped` | On-demand blocked by running scheduled fetch | dlqConfigId |
| `MessageIngested` | New message persisted in DB | messageId, dlqConfigId |
| `MessageStatusChanged` | Message status changes | messageId, oldStatus, newStatus |
| `MessageReplayed` | Replay completed successfully | messageId, targetTopic, replayedBy |
| `ReplayFailed` | Kafka publish failed | messageId, reason |
| `NoteAdded` | User adds a note | messageId, noteId, authorId |
| `UserAssignedToDlqConfig` | Admin assigns user to DLQ | userId, dlqConfigId, role |
| `PartitionReconciled` | New partition detected | dlqConfigId, partition |

---

## Domain Rules

1. **ADMIN** has implicit read and replay access to all DLQ configs.
2. **VIEWER** can read messages and add notes on DLQ configs they are assigned to.
3. **OPERATOR** can do everything VIEWER can, plus execute replay, edit payload before replay, and override the replay topic.
4. An on-demand fetch is rejected if a scheduled fetch is running on the same DLQ config.
5. The committed offset cannot be manually reset (no re-download).
6. A new fetch starts from `earliest` for partitions never seen before.
7. If Kafka has deleted messages before the last committed offset, the system logs the gap and restarts from the earliest available offset.
8. An edited payload must pass schema validation before replay is confirmed.
9. Every replay (successful or failed) produces an immutable `ReplayAuditRecord`.
10. Kafka credentials are encrypted at rest (AES-256) with a key from an environment variable.
11. The first user registered in standalone mode automatically becomes ADMIN.
12. Message retention (by days or count) is configurable per DLQ config and enforced by a scheduled job.

---

## Hexagonal Architecture — Main Ports

### Inbound Ports (Driving)
- `FetchMessagesUseCase` — initiates fetch (scheduled/on-demand)
- `ReplayMessageUseCase` — replay wizard (single) + bulk replay
- `InspectMessagesUseCase` — per-DLQ list, cross-DLQ (All Messages), filters, detail
- `ManageClusterUseCase` — cluster + DLQ config CRUD
- `ManageUsersUseCase` — user CRUD, role assignment
- `AddNoteUseCase` — add note to a message
- `DashboardUseCase` *(admin only)* — summary cards, replay rate sparkline

### Outbound Ports (Driven)
- `KafkaConsumerPort` — fetch messages from a Kafka topic
- `KafkaProducerPort` — publish message to a topic
- `SchemaRegistryPort` — payload decode/encode, schema validation
- `MessageRepository` — DlqMessage persistence
- `DlqConfigRepository` — DlqConfig persistence
- `UserRepository` — User persistence
- `AuditRepository` — ReplayAuditRecord persistence
- `NotificationPort` — SSE event push to the frontend
- `EncryptionPort` — credential encryption/decryption
