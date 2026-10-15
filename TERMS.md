# TERMS.md — Dead Letter Society Glossary

Canonical terminology for the project. All documents, code, tests, and communications MUST use these terms without drift.

---

## A

**All Messages**
Cross-DLQ view showing all `DlqMessage` records accessible to the current user, regardless of which DLQ Config they belong to. Supports filtering by status. Accessible to all authenticated users. Navigable from the "All Messages" global link in the sidebar.

**ADMIN**
Global role. User with full application access: manages clusters, DLQ configs, and users. Has implicit read and replay access to all DLQ configs. Multiple ADMINs can exist. The first user registered in standalone mode automatically becomes ADMIN.

**Audit Record** → see *Replay Audit Record*

---

## B

**Badge Count**
Numeric indicator shown in the Sidebar next to each DLQ Config name. Displays the number of messages with status `NEW` in the DLQ Config. Absent (zero or muted dot) when there are no NEW messages.

**Batch Size**
Maximum number of messages downloaded from Kafka in a single Fetch. Configurable per DLQ Config. Default: 500.

**Bootstrap Servers**
List of Kafka brokers in `host:port,...` format used to connect to the cluster.

---

## C

**Cluster** → see *Kafka Cluster*

**Committed Offset**
The last successfully consumed offset persisted in the application database for a specific (DLQ Config × Partition) pair. Not committed to the Kafka broker.

**Confluent Schema Registry**
The Schema Registry implementation supported in the MVP. Exposes a REST API for registering and retrieving schemas (Avro, Protobuf, JSON Schema).

**Cron Expression**
A cron-format string (e.g. `0 */15 * * * ?`) that defines the frequency of a scheduled Fetch. Configurable per DLQ Config with predefined presets as shortcuts.

---

## D

**Dashboard**
Home screen for ADMIN users. Displays Summary Cards (counts by status), DLQ Status Table (state per DLQ Config), and Replay Rate Sparkline (replay rate chart for the last 7 days). Accessible exclusively to ADMINs; other users are redirected to the cluster list.

**Dead Letter Queue (DLQ)**
A Kafka topic where messages are automatically routed when a consumer fails to process them. Messages in a DLQ are candidates for inspection and potential Replay.

**Decoded Payload**
The human-readable representation of a message payload, obtained by decoding the raw bytes via the Schema Registry. Format: JSON. May be `null` if the schema is unavailable or the payload is malformed.

**DLQ Config (Dead Letter Queue Configuration)**
A configuration that represents the monitoring contract between the application and a DLQ topic on a Kafka Cluster. Contains: topic name, fetch config, retention policy, user assignments, partition offsets. The access unit on which VIEWER/OPERATOR roles are assigned.

**DLQ Message** → see *Message*

**DLQ Role** → see *Role*

**Download** → see *Fetch*

**Download Mode** → see *Fetch Mode*

---

## E

**Encryption Key**
AES-256 key used to encrypt sensitive credentials (e.g. Kafka passwords, certificates) in the database. Read from an environment variable at application runtime.

---

## F

**Failure Info**
Normalized view of a Message's failure attributes (original topic, partition, offset, timestamp, exception message, stacktrace), derived from its stored Headers through the DLQ Config's Header Mapping. Any attribute may be absent; absence never blocks viewing or Replay.

**Fetch**
Operation that downloads messages from a Kafka DLQ topic into the application database. Can be a Scheduled Fetch or an On-Demand Fetch. Each Fetch starts from the Committed Offset + 1 of the affected partition.

**Fetch Config**
Part of the DLQ Config that defines fetch behavior: Fetch Mode, Cron Expression (if scheduled), Batch Size.

**Fetch Mode**
Execution mode for a DLQ Config's Fetch. Values:
- `SCHEDULED` — automatic fetch only, at cron intervals
- `ON_DEMAND` — manual fetch only, triggered by a user
- `BOTH` — both modes coexist

---

## G

**Gap (offset gap)**
A situation where messages between the Committed Offset and the earliest available offset on Kafka have been deleted (by compaction or Kafka retention). The system logs the gap and restarts from the earliest available offset.

**Global Role** → see *Role*

---

## H

**Header Mapping**
Per-DLQ-Config declaration of which Kafka header holds each failure attribute and how binary values are encoded (STRING, INT32, INT64). Chosen through a → *Header Preset* or defined by hand (CUSTOM).

**Header Preset**
Predefined Header Mapping: LEGACY (`x-original-topic`, default), SPRING (`kafka_dlt-*`), QUARKUS_SMALLRYE (`dead-letter-*`), or CUSTOM (user-defined).

**Headers**
Key-value metadata attached to a Kafka message. Include technical information such as the original topic and exception details; their names depend on the producing framework and are described by the DLQ Config's → *Header Mapping*. Preserved in full during Replay; `x-dls-replayed-at` and `x-dls-replayed-by` are added.

---

## I

**Ingestion** → see *Fetch*

---

## K

**Kafka Cluster**
A set of Kafka brokers identified by Bootstrap Servers, security configuration, and Schema Registry. The registration unit in the application. Each Kafka Cluster has exactly one Schema Registry.

**Kafka Security Config**
Authentication and encryption configuration for connecting to a Kafka Cluster. Supported protocols: `PLAINTEXT`, `SASL_PLAIN`, `SASL_SCRAM_SHA_256`, `SASL_SCRAM_SHA_512`, `SSL`.

---

## M

**Message**
A Kafka message downloaded from a DLQ and persisted in the application database. Contains: partition, offset, timestamp, message key, raw payload, decoded payload, headers, status, note thread, replay audit record.

**Message Key**
The optional key of a Kafka message (bytes). Stored in the database for reference.

**Message Status**
The lifecycle state of a Message in the system. Values and transitions:
```
NEW → UNDER_REVIEW → REPLAYED
                   ↘ DISCARDED
                   ↘ REPLAY_FAILED ⟳ retry → UNDER_REVIEW
```

---

## N

**Note**
A single text comment added by a user to a Message. May contain an optional Ticket Reference. Notes are immutable after creation.

**Note Thread**
An ordered sequence of Notes associated with a Message. Equivalent to a comment thread.

---

## O

**OIDC (OpenID Connect)**
Federated authentication protocol. In OIDC mode, the user's identity is managed by an external Identity Provider (Keycloak, Okta, etc.). The ADMIN role can be mapped from a claim in the JWT. DLQ roles (VIEWER/OPERATOR) are always managed by the application.

**On-Demand Fetch**
A Fetch triggered manually by any user with access to the DLQ Config. Rejected if a Scheduled Fetch is running on the same DLQ Config.

**OPERATOR**
DLQ Role. Can: read messages, add notes, execute Replay, edit the Decoded Payload before Replay (with schema validation), override the Replay Topic. Assigned per-user on a specific DLQ Config.

---

## P

**Partition**
A subdivision of a Kafka topic. Each partition has its own Committed Offset in the application database.

**Partition Offset**
A database record tracking the Committed Offset for a (DLQ Config × Partition) pair. Status: `ACTIVE` or `INACTIVE`.

**Partition Reconciliation**
An operation performed at the start of each Fetch that compares the partitions known in the database with the actual partitions on the Kafka broker. New partitions are added with offset `-1` (earliest). Removed partitions are marked `INACTIVE`.

**Payload** → see *Raw Payload* or *Decoded Payload*

---

## R

**Bulk Replay**
A simplified Replay operation applied to multiple messages selected simultaneously in the Message List. The target is the Default Replay Topic of the DLQ Config. Does not include payload editing or a multi-step wizard. Produces a Replay Audit Record per message. OPERATOR and ADMIN only.

**Raw Payload**
The original bytes of a Kafka message payload, stored in the database without modification.

**Replay**
The operation of republishing a Message to the Replay Topic. Executed through the Replay Wizard. OPERATOR only (and implicit ADMIN). The payload can be edited (with schema validation) before confirmation.

**Replay Audit Record**
An immutable record documenting a Replay execution: who performed the replay, when, on which topic, whether the payload was edited, number of attempts, and optional failure reason.

**Replay Failed**
A Message state in which Replay was attempted but publishing to Kafka failed. The user can retry the Replay (transition → `UNDER_REVIEW`).

**Replay Topic**
The Kafka topic to which a Message is republished during Replay. Determined in priority order:
1. Explicit override set by OPERATOR in the DLQ Config or during the wizard
2. Value of the original-topic header in the message, as named by the DLQ Config's → *Header Mapping*

**Replay Rate**
A metric expressing the percentage of Replayed messages out of the total messages in a given period. Formula: `REPLAYED / (REPLAYED + DISCARDED + UNDER_REVIEW + REPLAY_FAILED + NEW)`. Displayed in the Dashboard as a Sparkline Chart.

**Replay Wizard**
A guided multi-step interface for executing Replay of a single message. Includes: message preview, Replay Topic selection/confirmation, optional Decoded Payload editing, schema validation, final confirmation. For bulk replay use → *Bulk Replay*.

**Retention Policy**
Automatic message cleanup policy in the database. Configurable per DLQ Config. Can be based on: number of days (`maxAgeDays`) or maximum message count (`maxCount`).

**Role**
Determines permissions in the application. Two levels:
- **Global Role** (`ADMIN` / `USER`): defines global application permissions
- **DLQ Role** (`VIEWER` / `OPERATOR`): defines permissions on a specific DLQ Config

---

## S

**Settings**
Application area reachable via `/settings`. Contains: link to cluster management, link to user management (Members & Roles), light/dark mode toggle. Left navigation with "Clusters" and "Members & Roles" sections.

**Sidebar Badge** → see *Badge Count*

**Sparkline Chart**
A miniaturized area chart in the Dashboard showing daily Replay Rate for the last 7 days. Backend: `GET /api/dashboard/sparkline?days=7`.

**Summary Cards**
Five cards in the Dashboard showing the total message count for each status (NEW, UNDER_REVIEW, REPLAYED, DISCARDED, REPLAY_FAILED) across all accessible DLQ Configs.

**Schema**
A structured definition of a payload format. Registered in the Schema Registry. Supported formats: Avro, Protobuf, JSON Schema.

**Schema Registry**
An external service that manages Kafka message schemas. Used for payload decoding and validation. In the MVP: Confluent Schema Registry (one per Kafka Cluster).

**Schema Validation**
Verification that a payload (raw or edited) conforms to the schema registered in the Schema Registry. Performed before confirmation in the Replay Wizard when the payload has been edited.

**Scheduled Fetch**
A Fetch executed automatically by the system according to a Cron Expression configured in the DLQ Config.

**SSE (Server-Sent Events)**
Server-to-client push notification mechanism used for in-app notifications. The frontend subscribes to an SSE endpoint to receive real-time updates (e.g. new fetch completed, new messages available).

**Standalone Mode**
Application operating mode without integration with an external Identity Provider. Authentication uses local username/password. The first registered user becomes ADMIN.

---

## T

**Ticket Reference**
Optional text reference to a ticket in an external system (e.g. `JIRA-1234`, `INC0012345`). Manually entered by the user in a Note.

**Topic**
A messaging channel on a Kafka Cluster. DLQs are dedicated Kafka topics for failed messages.

**Topic Browser**
A feature that, given a Kafka Cluster configuration, queries the broker in real time and returns the list of available topics. The Topic Browser excludes internal broker topics (those whose name starts with `_`) and topics already configured as DLQ Configs on the same cluster. Used to assist the ADMIN in selecting the Topic Name when creating a DLQ Config.

**Topic Name**
The exact name of a Kafka topic configured as a DLQ in a DLQ Config. Immutable after the DLQ Config is created. The Topic Browser suggests valid names during creation.

**Problem Detail**
Standard HTTP error response format, defined by RFC 7807 (`application/problem+json`). Every API error response includes at minimum: `type` (URI), `title`, `status`, `detail`. Validation error responses (HTTP 422) add a `violations` array with per-field violations: `[{ "field": "...", "message": "..." }]`.

---

## U

**User**
A registered application user. Has a Global Role and may have DLQ Roles on one or more DLQ Configs. Authenticated via standalone mode (LOCAL) or OIDC.

**User Assignment**
Association between a User and a DLQ Config with a specific DLQ Role (VIEWER/OPERATOR).

---

## V

**VIEWER**
DLQ Role. Can: read messages, add notes. Cannot execute Replay. Assigned per-user on a specific DLQ Config.

---

## X

**`x-dls-replayed-at`**
Kafka header added by the system during Replay. Value: ISO-8601 timestamp of the replay operation.

**`x-dls-replayed-by`**
Kafka header added by the system during Replay. Value: user ID or email of the user who executed the replay.
