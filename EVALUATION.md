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

**[DLQCFG-006]** The system shall allow ADMIN to edit all fields of an existing DLQ Config — display name, Fetch Mode, Cron Expression, Batch Size, Retention Policy — except Topic Name, which is immutable after creation.

**[DLQCFG-007]** When ADMIN saves an edited DLQ Config, the system shall persist the updated configuration and navigate to the DLQ Config list, refreshing the displayed data.

**[DLQCFG-008]** When ADMIN edits a DLQ Config, the system shall display the Topic Name as a read-only field.

**[DLQCFG-009]** If ADMIN changes Fetch Mode from `SCHEDULED` to `ON_DEMAND` or vice versa, the system shall preserve the Committed Offsets and Partition Offset records without modification.

**[DLQCFG-010]** If a DLQ Config update request contains validation errors, then the system shall return HTTP 422 Problem Detail with a `violations` array identifying each invalid field and the reason.

**[DLQCFG-011]** When ADMIN saves a DLQ Config (create or edit), if the response contains field-level `violations`, the system shall highlight the corresponding form fields and display the error message inline below each field.

---

## 3b. Topic Browser

**[TOPIC-001]** The system shall expose `GET /api/clusters/{id}/topics` returning the list of Available Topics on the cluster's broker, filtered to exclude internal topics (those whose name starts with `_`).

**[TOPIC-002]** The system shall exclude from the Topic Browser results any topic already configured as a DLQ Config on the same Kafka Cluster.

**[TOPIC-003]** The system shall return Topic Browser results sorted alphabetically.

**[TOPIC-004]** When ADMIN opens the DLQ Config creation form, the system shall fetch the Available Topics list and populate the Topic Name combobox with the results.

**[TOPIC-005]** The system shall display Topic Browser suggestions in the combobox only when the user has typed at least 2 characters.

**[TOPIC-006]** The system shall allow the user to select a Topic Name from the suggestions or to type a name not present in the list (free-text entry).

**[TOPIC-007]** When the user enters a Topic Name not present in the Available Topics list, the system shall display an inline warning: the topic does not exist yet on the broker and no messages will be fetched until it is created.

**[TOPIC-008]** If the Topic Browser request fails (broker unreachable, authentication error), then the system shall display an error message below the Topic Name field and allow the user to continue with manual free-text entry.

**[TOPIC-009]** If the Topic Browser request fails, then the system shall not block form submission — the user can still save a DLQ Config with a manually entered Topic Name.

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

**[MSG-003]** The system shall display for each Message in the list: checkbox, status badge, timestamp, partition, offset, and a payload preview showing the first 80 characters of the raw JSON payload truncated with `…`.

**[MSG-004]** When a user opens a Message detail, the system shall display: full decoded payload (formatted JSON), raw payload (hex/base64), all Kafka headers, Message Status, ingestion timestamp, and Replay Audit Record (if present).

**[MSG-007]** The system shall display the Message List filter controls in a left-side panel (~220px wide) rather than an inline horizontal bar.

**[MSG-008]** When a user opens a Message detail, the system shall display the message metadata (partition, offset, Kafka timestamp, ingested at) in a 4-column grid layout.

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

## 7b. Bulk Replay

**[BULK-001]** The system shall allow OPERATOR and ADMIN to select multiple Messages in the Message List via checkboxes and initiate a Bulk Replay.

**[BULK-002]** When ≥1 Messages are selected in the Message List, the system shall display a "Replay (N selected)" button showing the count of selected messages.

**[BULK-003]** The system shall disable the "Replay (N selected)" button when none of the selected Messages have a resolvable Replay Topic (no Default Replay Topic on the DLQ Config and no `x-original-topic` header on any selected message).

**[BULK-004]** When the user confirms a Bulk Replay, the system shall replay all selected Messages to the Default Replay Topic of the DLQ Config without displaying the Replay Wizard and without payload editing.

**[BULK-005]** The system shall produce one immutable Replay Audit Record per Message in a Bulk Replay, each recording `replayedBy` (performing user ID).

**[BULK-006]** Each Message in a Bulk Replay shall transition to `REPLAYED` or `REPLAY_FAILED` independently based on its individual Kafka publish result.

**[BULK-007]** When a Bulk Replay completes, the system shall display a toast summarizing: N successful, N failed.

---

## 8. Dashboard *(ADMIN only)*

**[DASH-001]** When an ADMIN navigates to `/`, the system shall display the Dashboard as the home screen.

**[DASH-002]** When a non-ADMIN user navigates to `/`, the system shall redirect to the Kafka Cluster list.

**[DASH-003]** The system shall display the Dashboard with a loading skeleton while stats are being fetched from the backend.

**[DASH-004]** The Dashboard shall display five Summary Cards, one per Message Status (NEW, UNDER_REVIEW, REPLAYED, DISCARDED, REPLAY_FAILED), each showing the total message count across all DLQ Configs.

**[DASH-005]** The Dashboard shall display a caption showing the timestamp of when the stats were last computed (`computedAt` returned by the API).

**[DASH-006]** The Dashboard shall display a Sparkline Chart showing the daily Replay Rate (percentage of REPLAYED messages over total messages ingested that day) for the last 7 days.

**[DASH-007]** The Dashboard shall display a DLQ Status Table listing all DLQ Configs with: display name, cluster name, NEW message count, and last fetch timestamp. A DLQ Config with no ingested messages shall appear with zero counts.

**[DASH-008]** The system shall expose `GET /api/dashboard/summary` (ADMIN only) returning: per-status message counts and a `computedAt` timestamp.

**[DASH-009]** The system shall expose `GET /api/dashboard/sparkline?days=7` (ADMIN only) returning an array of daily data points `[{ date, replayed, total }]` for the requested window.

**[DASH-010]** If a non-ADMIN user calls `GET /api/dashboard/summary` or `GET /api/dashboard/sparkline`, then the system shall return HTTP 403 Problem Detail.

---

## 8b. All Messages

**[ALLMSG-001]** The system shall expose `GET /api/messages` returning Messages across all DLQ Configs accessible to the authenticated user, with optional `status` filter parameter.

**[ALLMSG-002]** The "All Messages" page shall be accessible from the global "All Messages" link in the Sidebar navigation and display the cross-DLQ message list.

**[ALLMSG-003]** The "All Messages" page shall support filtering by Message Status only.

**[ALLMSG-004]** The "All Messages" page shall display for each Message: Cluster name, DLQ Config display name, status badge, Kafka timestamp, partition, offset, and payload preview (first 80 chars truncated).

**[ALLMSG-005]** Each row in the "All Messages" list shall link to the Message Detail page.

---

## 8c. Sidebar Navigation

**[SIDEBAR-001]** The Sidebar shall display a global navigation section with links: "Overview" (→ Dashboard for ADMIN, → Cluster list for others) and "All Messages" (→ cross-DLQ message list).

**[SIDEBAR-002]** The Sidebar shall display a Badge Count (count of NEW messages) next to each DLQ Config name in the cluster accordion.

**[SIDEBAR-003]** When a DLQ Config has zero NEW messages, the system shall display a muted dot (no number) instead of a badge.

**[SIDEBAR-004]** When the system receives a `MESSAGE_STATUS_CHANGED` SSE event, the system shall update the Sidebar Badge Count for the affected DLQ Config without requiring a page reload.

---

## 8d. Settings

**[SETTINGS-001]** The system shall provide a `/settings` route displaying a left navigation panel with sections: "Clusters" (links to cluster management) and "Members & Roles" (links to user management).

**[SETTINGS-002]** The Settings page shall display a light/dark mode toggle.

**[SETTINGS-003]** When a user changes the theme via the toggle, the system shall persist the preference in `localStorage` under a stable key.

**[SETTINGS-004]** On application startup, before first render, the system shall read the theme preference from `localStorage` and apply it, preventing a flash of wrong theme.

---

## 10. Retention Policy

**[RETENTION-001]** The system shall execute a periodic retention job that deletes Messages from the database according to each DLQ Config's Retention Policy.

**[RETENTION-002]** The system shall support two Retention Policy types: `MAX_AGE_DAYS` (delete messages older than N days) and `MAX_COUNT` (keep only the N most recent messages).

**[RETENTION-003]** When the retention job runs, the system shall not notify connected users (silent deletion), and the message list shall reflect the updated state on next load or filter change.

---

## 11. API Error Format

**[API-001]** The system shall return all error responses with `Content-Type: application/problem+json` and a body conforming to RFC 7807, containing at minimum: `type`, `title`, `status`, `detail`.

**[API-002]** The system shall use the following `type` URI convention: `https://dls.io/problems/{code}` where `code` is a machine-readable identifier (e.g., `validation`, `not-found`, `conflict`, `forbidden`).

**[API-003]** If an API request results in a validation error (HTTP 422), then the system shall include in the Problem Detail body a `violations` array where each entry has `field` (JSON path of the invalid field) and `message` (human-readable reason).

**[API-004]** The system shall return HTTP 404 with Problem Detail for any resource not found.

**[API-005]** The system shall return HTTP 409 with Problem Detail for conflict conditions (e.g., duplicate email, fetch already in progress).

**[API-006]** The system shall return HTTP 403 with Problem Detail for authorization failures, including in `detail` the minimum required role.

---

## 12. Sicurezza

**[SEC-001]** The system shall not store plaintext Kafka credentials in the database.

**[SEC-002]** The system shall read the encryption key exclusively from the environment variable configured in `application.properties` (e.g., `${DLS_ENCRYPTION_KEY}`).

**[SEC-003]** If the encryption key environment variable is not set at startup, then the system shall fail to start and log a clear error message.

**[SEC-004]** The system shall enforce HTTPS in production (Docker Compose production profile).

---

## 13. Notifiche SSE

**[SSE-001]** The system shall provide a server-sent events (SSE) endpoint that authenticated users can subscribe to for real-time notifications.

**[SSE-002]** The system shall scope SSE events to the user's authorized DLQ Configs (a user shall not receive events for DLQ Configs they cannot access).

**[SSE-003]** The system shall emit the following SSE event types: `FETCH_COMPLETED`, `FETCH_FAILED`, `NOTE_ADDED`, `MESSAGE_STATUS_CHANGED`.

---

## 14. Sviluppo locale

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
| BULK-003 | `BulkReplayUseCase` (topic resolution check) | Unit |
| BULK-005, BULK-006 | `BulkReplayUseCase` (audit record + independent status) | Unit |
| DASH-008 | `DashboardUseCase` (summary counts) | Unit |
| DASH-009 | `DashboardUseCase` (sparkline aggregation) | Unit |
| AUTH-005, AUTH-006 | `AuthenticationService` | Unit |
| CLUSTER-004 | `CredentialEncryptionAdapter` | Unit |
| SEC-003 | `ApplicationStartup` | Unit |

### Integration Tests (backend — Quarkus + Testcontainers)

| ID | Scenario | Infrastruttura |
|----|----------|----------------|
| FETCH-001 ~ FETCH-012 | Fetch pipeline completo | Kafka + PostgreSQL + Schema Registry |
| CLUSTER-002, CLUSTER-003 | Connectivity test DLQ Config | Kafka + Schema Registry |
| REPLAY-006 ~ REPLAY-009 | Replay end-to-end | Kafka + PostgreSQL |
| BULK-004 ~ BULK-007 | Bulk Replay: N messaggi → auditRecord × N, status indipendenti, toast summary | Kafka + PostgreSQL |
| DASH-008, DASH-010 | Dashboard summary endpoint: conteggi corretti, 403 per non-ADMIN | PostgreSQL |
| DASH-009 | Dashboard sparkline: 7 data points, replay rate corretto | PostgreSQL |
| ALLMSG-001 | Cross-DLQ GET /api/messages: filtra per status, rispetta access control | PostgreSQL |
| AUTH-003 ~ AUTH-007 | Autenticazione standalone | PostgreSQL |
| AUTH-008 ~ AUTH-011 | Autenticazione OIDC | Keycloak (Testcontainers) |
| RETENTION-001, RETENTION-002 | Retention job | PostgreSQL |
| TOPIC-001 ~ TOPIC-003 | Topic Browser: filtra interni + già configurati + ordine | Kafka |
| DLQCFG-006 ~ DLQCFG-010 | Edit DLQ Config: aggiorna campi, immutabilità topicName, validazione | PostgreSQL |
| API-001 ~ API-006 | Tutti gli endpoint restituiscono problem+json per ogni categoria di errore | PostgreSQL |
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
| DLQCFG-006 ~ DLQCFG-009 | Modifica DLQ Config → salva → torna a lista | `e2e/dlqconfig/edit-dlqconfig.spec.ts` |
| DLQCFG-010, DLQCFG-011 | Errore validazione campo → highlight inline | `e2e/dlqconfig/edit-dlqconfig.spec.ts` |
| TOPIC-004 ~ TOPIC-007 | Topic Browser: combobox, ≥2 chars, selezione, warning topic inesistente | `e2e/dlqconfig/topic-browser.spec.ts` |
| TOPIC-008, TOPIC-009 | Topic Browser: broker irraggiungibile → errore inline, form ancora inviabile | `e2e/dlqconfig/topic-browser.spec.ts` |
| API-001 ~ API-003 | Risposte errore in application/problem+json con violations | `e2e/api/problem-json.spec.ts` |
| FETCH-007, FETCH-009 | Fetch on-demand → badge aggiornato + lista refresh | `e2e/fetch/on-demand-fetch.spec.ts` |
| FETCH-010 | On-demand fetch bloccato → toast "Fetch in corso" | `e2e/fetch/fetch-blocked.spec.ts` |
| DASH-001, DASH-002 | Admin vede Dashboard home; non-admin reindirizzato a cluster list | `e2e/dashboard/dashboard-home.spec.ts` |
| DASH-003 ~ DASH-007 | Dashboard: skeleton → summary cards → sparkline → DLQ table → computedAt | `e2e/dashboard/dashboard-content.spec.ts` |
| DASH-010 | Non-admin chiama /api/dashboard/summary → HTTP 403 | `e2e/dashboard/dashboard-auth.spec.ts` |
| MSG-001, MSG-002 | Filtri lista messaggi (stato, timestamp, partition) via side panel | `e2e/messages/filter-messages.spec.ts` |
| MSG-003 | Payload preview column: primi 80 chars troncati | `e2e/messages/message-list-columns.spec.ts` |
| MSG-004, MSG-008 | Dettaglio messaggio: payload JSON + headers + audit + 4-col metadata grid | `e2e/messages/message-detail.spec.ts` |
| MSG-007 | Filter panel è side panel sx (non inline bar) | `e2e/messages/filter-panel-layout.spec.ts` |
| BULK-001 ~ BULK-003 | Selezione messaggi → pulsante "Replay (N)" → disabilitato senza topic | `e2e/replay/bulk-replay-ui.spec.ts` |
| BULK-004, BULK-007 | Bulk replay → audit records + toast summary N ok / N falliti | `e2e/replay/bulk-replay.spec.ts` |
| ALLMSG-002 ~ ALLMSG-005 | "All Messages": filtro status, colonne Cluster+DLQ, link a detail | `e2e/messages/all-messages.spec.ts` |
| SIDEBAR-002 ~ SIDEBAR-004 | Badge count NEW per DLQ, dot muted se zero, aggiorna via SSE | `e2e/sidebar/sidebar-badge.spec.ts` |
| SETTINGS-001 ~ SETTINGS-004 | Settings: left nav, toggle light/dark, persiste in localStorage | `e2e/settings/settings.spec.ts` |
| NOTE-001 ~ NOTE-003 | Aggiunta nota → immediata + SSE real-time | `e2e/notes/add-note.spec.ts` |
| REPLAY-002 ~ REPLAY-007 | Replay wizard completo (OPERATOR) con visual stepper | `e2e/replay/replay-wizard.spec.ts` |
| REPLAY-004, REPLAY-005 | Editing payload invalido → "Confirm" disabilitato | `e2e/replay/payload-validation.spec.ts` |
| REPLAY-008 | Replay fallito → toast errore + retry | `e2e/replay/replay-failed.spec.ts` |
| AUTH-013 | Chiamata API non autorizzata → HTTP 403 con messaggio specifico | `e2e/auth/api-403.spec.ts` |
