# EVALUATION.md — Dead Letter Society

Requisiti formali in formato EARS. Questo documento è la base per le test suite del progetto (unit, integration, Playwright E2E). Ogni requisito ha un ID univoco referenziabile nei test.

Terminologia: → `TERMS.md`. Modello di dominio: → `DOMAIN.md`.

---

## Legenda pattern EARS

| Pattern | Template |
|---------|----------|
| **Ubiquitous** | The `[system]` shall `[action]` |
| **Event-Driven** | When `[trigger]`, the `[system]` shall `[action]` |
| **State-Driven** | While `[state]`, the `[system]` shall `[action]` |
| **Unwanted Behavior** | If `[condition]`, then the `[system]` shall `[action]` |
| **Optional** | Where `[feature is enabled]`, the `[system]` shall `[action]` |

---

## 1. Autenticazione & Autorizzazione

### 1.1 Standalone — First Run
**[AUTH-001]** When the application starts with an empty database, the system shall display a dedicated "Create Administrator Account" setup screen before allowing any other navigation.

**[AUTH-002]** When the first user completes the setup form, the system shall create the user account with `GlobalRole = ADMIN` and redirect to the application home.

### 1.2 Standalone — Login
**[AUTH-003]** When a user submits valid credentials, the system shall authenticate the user and issue a session token valid for the configured session duration.

**[AUTH-004]** When a user submits invalid credentials, the system shall increment the failed attempt counter for that account and display a generic authentication error without revealing whether email or password was wrong.

**[AUTH-005]** If a user accumulates 5 consecutive failed login attempts, then the system shall lock the account and display a message indicating that an ADMIN must unlock it.

**[AUTH-006]** While an account is locked, the system shall reject all login attempts for that account regardless of credential correctness.

**[AUTH-007]** The system shall allow only an ADMIN to unlock a locked account.

### 1.3 OIDC
**[AUTH-008]** Where OIDC is enabled, the system shall redirect unauthenticated users to the configured Identity Provider login page.

**[AUTH-009]** Where OIDC is enabled, when a user completes OIDC authentication for the first time, the system shall auto-provision a local user account with `GlobalRole = USER` and redirect to the application home.

**[AUTH-010]** Where OIDC is enabled and the JWT contains the configured ADMIN claim, the system shall assign `GlobalRole = ADMIN` to the provisioned user.

**[AUTH-011]** Where OIDC is enabled, when a returning user authenticates, the system shall re-evaluate the ADMIN claim in the JWT and update `GlobalRole` accordingly.

### 1.4 Autorizzazione
**[AUTH-012]** The system shall hide or disable UI controls for actions the authenticated user is not authorized to perform.

**[AUTH-013]** If an authenticated user calls an API endpoint for an unauthorized action, then the system shall return HTTP 403 with a machine-readable error code and a human-readable message specifying the required role (e.g., `"OPERATOR role required"`).

**[AUTH-014]** The system shall grant ADMIN implicit read and replay access to all DLQ Configs without explicit User Assignment.

**[AUTH-015]** The system shall allow only ADMIN to create, update, or delete Kafka Clusters, DLQ Configs, and User Assignments.

---

## 2. Gestione Kafka Cluster

**[CLUSTER-001]** The system shall allow ADMIN to register a new Kafka Cluster with: name, bootstrap servers, security protocol, and Schema Registry URL.

**[CLUSTER-002]** When ADMIN saves a new Kafka Cluster or DLQ Config, the system shall perform a connectivity test against the Kafka broker and Schema Registry before persisting the configuration.

**[CLUSTER-003]** If the connectivity test fails during Kafka Cluster or DLQ Config save, then the system shall reject the save operation and display a specific error message identifying the failing component (broker or Schema Registry) and the failure reason.

**[CLUSTER-004]** The system shall encrypt all Kafka security credentials (passwords, certificates) at rest using AES-256 with a key read from the configured environment variable.

**[CLUSTER-005]** The system shall support the following Kafka security protocols: `PLAINTEXT`, `SASL_PLAIN`, `SASL_SCRAM_SHA_256`, `SASL_SCRAM_SHA_512`, `SSL`.

**[CLUSTER-006]** The system shall associate exactly one Schema Registry configuration per Kafka Cluster.

---

## 3. DLQ Config

**[DLQCFG-001]** The system shall allow ADMIN to create a DLQ Config specifying: display name, topic name, Fetch Mode (`SCHEDULED` / `ON_DEMAND` / `BOTH`), Batch Size, and Retention Policy.

**[DLQCFG-002]** If Fetch Mode is `SCHEDULED` or `BOTH`, then the system shall require a valid Cron Expression before allowing the DLQ Config to be saved.

**[DLQCFG-003]** The system shall offer preset Cron Expression shortcuts (e.g., "every 5 minutes", "every hour", "daily at midnight") in the UI while allowing a custom cron expression to be entered manually.

**[DLQCFG-004]** The system shall allow ADMIN to assign a User to a DLQ Config with role `VIEWER` or `OPERATOR`.

**[DLQCFG-005]** The system shall allow ADMIN to set an explicit Replay Topic override on a DLQ Config.

---

## 4. Fetch (Message Ingestion)

**[FETCH-001]** The system shall manage the Committed Offset for each (DLQ Config × Partition) pair within its own database, without committing offsets to the Kafka broker.

**[FETCH-002]** When a Fetch starts for a partition with no prior Committed Offset, the system shall begin consuming from the `earliest` available offset on that partition.

**[FETCH-003]** When a Fetch starts, the system shall perform Partition Reconciliation: query the broker for the current partition list and add new partitions with initial offset `-1` (earliest).

**[FETCH-004]** If a gap is detected between the Committed Offset and the earliest available Kafka offset, then the system shall log the gap (partition, expected offset, actual earliest offset) and resume from the earliest available offset.

**[FETCH-005]** The system shall consume at most `batchSize` messages per Fetch execution per partition.

**[FETCH-006]** When a Scheduled Fetch completes successfully, the system shall update the Committed Offset, persist the new Messages in the database, and emit an SSE event to all connected users with access to the DLQ Config containing the count of new messages.

**[FETCH-007]** When a Scheduled Fetch completes successfully, the system shall update the message badge counter and refresh the message list in the UI of all connected users via SSE.

**[FETCH-008]** When a Fetch fails (broker unreachable, authentication error, Schema Registry error), the system shall emit an SSE event with a human-readable error message to all connected users with access to the DLQ Config.

**[FETCH-009]** When a user triggers an On-Demand Fetch, the system shall start the fetch if no other fetch is running for that DLQ Config.

**[FETCH-010]** If an On-Demand Fetch is requested while a Scheduled Fetch is already running for the same DLQ Config, then the system shall reject the request with HTTP 409 and the UI shall display a toast notification: "Fetch already in progress".

**[FETCH-011]** The system shall store the raw payload bytes and the decoded payload (JSON representation) for each ingested Message.

**[FETCH-012]** If the Schema Registry is unavailable or the schema is not found during Fetch, then the system shall persist the raw payload and set the decoded payload to `null`, marking the message with a `SCHEMA_DECODE_FAILED` flag.

---

## 5. Ispezione Messaggi

**[MSG-001]** The system shall display the message list for a DLQ Config with server-side filtering and pagination.

**[MSG-002]** The system shall support filtering the message list by: Message Status, timestamp range (from/to), partition number, and offset range (from/to).

**[MSG-003]** The system shall display for each Message in the list: status badge, timestamp, partition, offset, and a preview of the decoded payload (truncated).

**[MSG-004]** When a user opens a Message detail, the system shall display: full decoded payload (formatted JSON), raw payload (hex/base64), all Kafka headers, Message Status, ingestion timestamp, and Replay Audit Record (if present).

**[MSG-005]** While a user is viewing the detail of a Message that gets deleted by the Retention Policy job, the system shall display a "Message no longer available" notification and redirect the user to the message list.

**[MSG-006]** The system shall allow users with `VIEWER` or `OPERATOR` role (or ADMIN) to change Message Status to `UNDER_REVIEW` or `DISCARDED`.

---

## 6. Note Thread

**[NOTE-001]** The system shall allow any user with access to a DLQ Config to add a Note to a Message.

**[NOTE-002]** When a user adds a Note, the system shall display the note immediately in the Note Thread without requiring a page refresh.

**[NOTE-003]** When a user adds a Note, the system shall emit an SSE event to all other users currently viewing the same Message, causing their Note Thread to update in real time.

**[NOTE-004]** The system shall display each Note with: author display name, creation timestamp, content, and Ticket Reference (if present).

**[NOTE-005]** The system shall treat Notes as immutable after creation (no edit or delete).

---

## 7. Replay

**[REPLAY-001]** The system shall allow only users with `OPERATOR` role or ADMIN to initiate a Replay.

**[REPLAY-002]** When an OPERATOR initiates a Replay, the system shall display a multi-step Replay Wizard showing: Message summary, resolved Replay Topic, decoded payload (editable for OPERATOR), and a confirmation step.

**[REPLAY-003]** The system shall resolve the Replay Topic in the following priority order:
  1. Explicit override set on the DLQ Config or entered in the wizard by the OPERATOR
  2. Value of the `x-original-topic` header (or equivalent) in the Message headers

**[REPLAY-004]** When an OPERATOR modifies the Decoded Payload in the Replay Wizard, the system shall validate the modified payload against the schema in the Schema Registry before enabling the "Confirm" button.

**[REPLAY-005]** While the modified payload contains schema violations, the system shall keep the "Confirm Replay" button disabled and display a message identifying the violated field(s).

**[REPLAY-006]** When the user confirms the Replay, the system shall publish the message to the Replay Topic on Kafka, preserving all original headers and adding `x-dls-replayed-at` (ISO-8601 timestamp) and `x-dls-replayed-by` (user identifier).

**[REPLAY-007]** When a Replay completes successfully, the system shall:
  - Update the Message Status to `REPLAYED`
  - Display a success toast notification
  - Persist an immutable Replay Audit Record on the Message
  - Make the Replay Audit Record immediately visible in the Message detail

**[REPLAY-008]** If the Kafka publish during Replay fails, then the system shall:
  - Update the Message Status to `REPLAY_FAILED`
  - Display an error toast notification with the failure reason
  - Persist a Replay Audit Record with `failureReason` populated
  - Allow the user to retry the Replay (transition back to `UNDER_REVIEW`)

**[REPLAY-009]** The system shall increment `attemptCount` in the Replay Audit Record on each retry.

---

## 8. Retention Policy

**[RETENTION-001]** The system shall execute a periodic retention job that deletes Messages from the database according to each DLQ Config's Retention Policy.

**[RETENTION-002]** The system shall support two Retention Policy types: `MAX_AGE_DAYS` (delete messages older than N days) and `MAX_COUNT` (keep only the N most recent messages).

**[RETENTION-003]** When the retention job runs, the system shall not notify connected users (silent deletion), and the message list shall reflect the updated state on next load or filter change.

---

## 9. Sicurezza

**[SEC-001]** The system shall not store plaintext Kafka credentials in the database.

**[SEC-002]** The system shall read the encryption key exclusively from the environment variable configured in `application.properties` (e.g., `${DLS_ENCRYPTION_KEY}`).

**[SEC-003]** If the encryption key environment variable is not set at startup, then the system shall fail to start and log a clear error message.

**[SEC-004]** The system shall enforce HTTPS in production (Docker Compose production profile).

---

## 10. Notifiche SSE

**[SSE-001]** The system shall provide a server-sent events (SSE) endpoint that authenticated users can subscribe to for real-time notifications.

**[SSE-002]** The system shall scope SSE events to the user's authorized DLQ Configs (a user shall not receive events for DLQ Configs they cannot access).

**[SSE-003]** The system shall emit the following SSE event types: `FETCH_COMPLETED`, `FETCH_FAILED`, `NOTE_ADDED`, `MESSAGE_STATUS_CHANGED`.

---

## 11. Sviluppo locale

**[DEV-001]** The system shall support local development using Quarkus Dev Services, which automatically provisions PostgreSQL, Kafka, and Confluent Schema Registry via Testcontainers/OrbStack without manual configuration.

---

## Test Suite — Mapping

### Unit Tests (backend — JUnit 5 + Mockito)

| ID | Classe/Metodo | Tipo |
|----|---------------|------|
| FETCH-002, FETCH-004 | `FetchOffsetManager` | Unit |
| FETCH-003 | `PartitionReconciliationService` | Unit |
| FETCH-005 | `KafkaConsumerAdapter` | Unit |
| REPLAY-003 | `ReplayTopicResolver` | Unit |
| REPLAY-004, REPLAY-005 | `SchemaValidationService` | Unit |
| REPLAY-006 | `ReplayMessageUseCase` | Unit |
| AUTH-005, AUTH-006 | `AuthenticationService` | Unit |
| CLUSTER-004 | `CredentialEncryptionAdapter` | Unit |
| SEC-003 | `ApplicationStartup` | Unit |

### Integration Tests (backend — Quarkus + Testcontainers)

| ID | Scenario | Infrastruttura |
|----|----------|----------------|
| FETCH-001 ~ FETCH-012 | Fetch pipeline completo | Kafka + PostgreSQL + Schema Registry |
| CLUSTER-002, CLUSTER-003 | Connectivity test DLQ Config | Kafka + Schema Registry |
| REPLAY-006 ~ REPLAY-009 | Replay end-to-end | Kafka + PostgreSQL |
| AUTH-003 ~ AUTH-007 | Autenticazione standalone | PostgreSQL |
| AUTH-008 ~ AUTH-011 | Autenticazione OIDC | Keycloak (Testcontainers) |
| RETENTION-001, RETENTION-002 | Retention job | PostgreSQL |
| SEC-001, SEC-002 | Encryption at rest | PostgreSQL |

### E2E Tests — Playwright

| ID | Scenario | File test |
|----|----------|-----------|
| AUTH-001, AUTH-002 | First run setup screen → crea admin | `e2e/auth/first-run.spec.ts` |
| AUTH-003 | Login standalone con credenziali valide | `e2e/auth/login.spec.ts` |
| AUTH-004, AUTH-005 | Lockout dopo 5 tentativi falliti | `e2e/auth/lockout.spec.ts` |
| AUTH-008, AUTH-009 | Login OIDC → auto-provisioning | `e2e/auth/oidc-login.spec.ts` |
| AUTH-012 | Pulsanti non visibili per azioni non autorizzate (VIEWER non vede replay) | `e2e/auth/rbac-ui.spec.ts` |
| CLUSTER-001, CLUSTER-003 | Crea Kafka Cluster con SR irraggiungibile → errore bloccante | `e2e/cluster/create-cluster.spec.ts` |
| DLQCFG-001 ~ DLQCFG-003 | Crea DLQ Config con cron preset + custom | `e2e/dlqconfig/create-dlqconfig.spec.ts` |
| FETCH-007, FETCH-009 | Fetch on-demand → badge aggiornato + lista refresh | `e2e/fetch/on-demand-fetch.spec.ts` |
| FETCH-010 | On-demand fetch bloccato → toast "Fetch in corso" | `e2e/fetch/fetch-blocked.spec.ts` |
| MSG-001, MSG-002 | Filtri lista messaggi (stato, timestamp, partition) | `e2e/messages/filter-messages.spec.ts` |
| MSG-004 | Dettaglio messaggio: payload JSON + headers + audit | `e2e/messages/message-detail.spec.ts` |
| NOTE-001 ~ NOTE-003 | Aggiunta nota → immediata + SSE real-time | `e2e/notes/add-note.spec.ts` |
| REPLAY-002 ~ REPLAY-007 | Replay wizard completo (OPERATOR) | `e2e/replay/replay-wizard.spec.ts` |
| REPLAY-004, REPLAY-005 | Editing payload invalido → "Confirm" disabilitato | `e2e/replay/payload-validation.spec.ts` |
| REPLAY-008 | Replay fallito → toast errore + retry | `e2e/replay/replay-failed.spec.ts` |
| AUTH-013 | Chiamata API non autorizzata → HTTP 403 con messaggio specifico | `e2e/auth/api-403.spec.ts` |
