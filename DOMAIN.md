# DOMAIN.md — Dead Letter Society

## Overview

**UI Language:** English only. No internationalization (i18n) planned.

Dead Letter Society (DLS) è un'applicazione web operativa per il monitoraggio, l'ispezione e il replay dei messaggi nelle Dead Letter Queue (DLQ) di cluster Kafka. Supporta multi-cluster, autenticazione standalone e OIDC, schema decoding, annotazione collaborativa e replay guidato con validazione schema.

---

## Bounded Contexts

### 1. Cluster Management
Gestione delle configurazioni dei cluster Kafka e delle relative DLQ. Responsabilità dell'ADMIN.

**Contiene:**
- Registrazione e configurazione di `KafkaCluster`
- Configurazione di `SchemaRegistry` (uno per cluster)
- Creazione e gestione di `DlqConfig`
- Modifica di `DlqConfig` (tutti i campi eccetto `topicName`, che è immutabile dopo la creazione)
- Topic Browser: enumerazione live dei topic disponibili su un Kafka Cluster per assistere nella selezione del `topicName`
- Assegnazione di utenti a `DlqConfig` con ruoli

### 2. Identity & Access
Gestione utenti, autenticazione (standalone/OIDC) e autorizzazione (ruoli globali e per-DLQ).

**Contiene:**
- Registrazione e gestione `User`
- Autenticazione locale (username/password)
- Federazione OIDC (mapping claim → ruolo ADMIN)
- Assegnazione ruoli `VIEWER`/`OPERATOR` per DLQ config

### 3. Message Ingestion
Download dei messaggi dalle DLQ Kafka verso il DB dell'applicazione. Gestione offset, scheduling e fetch on-demand.

**Contiene:**
- Esecuzione fetch (schedulato/on-demand)
- Gestione `PartitionOffset` per ogni coppia (DlqConfig × partizione)
- Partition reconciliation
- Schema decoding (Avro / Protobuf / JSON Schema via Confluent Schema Registry)
- Deduplication per offset

### 4. Message Inspection
Ispezione, filtraggio e annotazione dei messaggi scaricati.

**Contiene:**
- Lista e dettaglio `DlqMessage`
- Filtri (stato, timestamp, partition, offset range)
- `NoteThread` — thread di commenti per messaggio
- Ticket Reference (riferimento manuale a sistema esterno)
- Notifiche in-app via SSE al completamento del fetch

### 5. Replay
Reimmissione guidata di un messaggio sul topic originale, con validazione schema opzionale ed editing payload.

**Contiene:**
- Replay wizard (multi-step, conferma UI)
- Editing payload decodificato con validazione schema (solo OPERATOR)
- Risoluzione topic target (header → override esplicito)
- Pubblicazione su Kafka con aggiunta header di tracciamento
- `ReplayAuditRecord`
- Transizioni di stato messaggio

---

## Aggregates & Entities

### `KafkaCluster` *(Aggregate Root)*
Rappresenta un cluster Kafka monitorato.

| Campo | Tipo | Note |
|-------|------|------|
| `id` | UUID | |
| `name` | String | nome leggibile |
| `bootstrapServers` | String | `host:port,...` |
| `securityConfig` | `KafkaSecurityConfig` | value object |
| `schemaRegistry` | `SchemaRegistryConfig` | embedded entity, uno per cluster |
| `dlqConfigs` | List\<DlqConfig\> | |

### `SchemaRegistryConfig` *(Entity)*
Configurazione del Confluent Schema Registry associato al cluster.

| Campo | Tipo | Note |
|-------|------|------|
| `url` | String | |
| `authConfig` | `SchemaRegistryAuthConfig` | credenziali opzionali |

### `DlqConfig` *(Aggregate Root)*
Configurazione per il monitoraggio di un topic DLQ su un cluster.

| Campo | Tipo | Note |
|-------|------|------|
| `id` | UUID | |
| `clusterId` | UUID | FK → KafkaCluster |
| `topicName` | String | nome del topic DLQ |
| `displayName` | String | nome UI |
| `fetchConfig` | `FetchConfig` | mode, cron, batchSize |
| `retentionPolicy` | `RetentionPolicy` | days o maxCount |
| `defaultReplayTopic` | String? | override esplicito topic replay |
| `userAssignments` | List\<UserAssignment\> | User × Role |
| `partitionOffsets` | List\<PartitionOffset\> | stato fetch per partizione |

### `FetchConfig` *(Value Object)*

| Campo | Tipo | Note |
|-------|------|------|
| `mode` | `DownloadMode` | SCHEDULED / ON_DEMAND / BOTH |
| `cronExpression` | String? | obbligatorio se SCHEDULED o BOTH |
| `batchSize` | Int | default 500 |

### `PartitionOffset` *(Value Object)*

| Campo | Tipo | Note |
|-------|------|------|
| `partition` | Int | |
| `lastOffset` | Long | -1 = non ancora fetchato (earliest) |
| `status` | `PartitionStatus` | ACTIVE / INACTIVE |
| `updatedAt` | Instant | |

### `UserAssignment` *(Value Object)*

| Campo | Tipo | Note |
|-------|------|------|
| `userId` | UUID | |
| `role` | `DlqRole` | VIEWER / OPERATOR |

### `DlqMessage` *(Aggregate Root)*
Un messaggio scaricato da una DLQ e persistito nel DB.

| Campo | Tipo | Note |
|-------|------|------|
| `id` | UUID | |
| `dlqConfigId` | UUID | FK → DlqConfig |
| `partition` | Int | |
| `offset` | Long | |
| `timestamp` | Instant | timestamp Kafka |
| `messageKey` | Bytes? | chiave Kafka raw |
| `rawPayload` | Bytes | payload raw |
| `decodedPayload` | JsonNode? | payload decodificato via schema |
| `schemaId` | Int? | ID schema nel registry |
| `headers` | Map\<String,String\> | headers Kafka originali |
| `status` | `MessageStatus` | ciclo di vita |
| `noteThread` | `NoteThread` | embedded |
| `replayAudit` | `ReplayAuditRecord`? | presente se replay eseguito |
| `ingestedAt` | Instant | timestamp inserimento nel DB |

### `NoteThread` *(Entity embedded in DlqMessage)*
Thread di commenti associato a un messaggio.

| Campo | Tipo |
|-------|------|
| `notes` | List\<Note\> |

### `Note` *(Entity)*

| Campo | Tipo | Note |
|-------|------|------|
| `id` | UUID | |
| `authorId` | UUID | |
| `content` | String | testo libero |
| `ticketReference` | String? | es. "JIRA-1234" |
| `createdAt` | Instant | |

### `ReplayAuditRecord` *(Value Object embedded in DlqMessage)*

| Campo | Tipo | Note |
|-------|------|------|
| `replayedBy` | UUID | userId |
| `replayedAt` | Instant | |
| `targetTopic` | String | topic su cui è stato pubblicato |
| `payloadEdited` | Boolean | true se payload modificato prima del replay |
| `failureReason` | String? | presente se REPLAY_FAILED |
| `attemptCount` | Int | numero di tentativi (retry inclusi) |

### `User` *(Aggregate Root)*

| Campo | Tipo | Note |
|-------|------|------|
| `id` | UUID | |
| `email` | String | |
| `displayName` | String | |
| `authProvider` | `AuthProvider` | LOCAL / OIDC |
| `globalRole` | `GlobalRole` | ADMIN / USER |
| `passwordHash` | String? | solo LOCAL |
| `oidcSubject` | String? | solo OIDC |

---

## Value Objects — Enumerazioni

### `MessageStatus`
```
NEW → UNDER_REVIEW → REPLAYED
                   ↘ DISCARDED
                   ↘ REPLAY_FAILED ⟳ retry → UNDER_REVIEW
```

### `DownloadMode`
`SCHEDULED` | `ON_DEMAND` | `BOTH`

### `DlqRole` (ruolo per-DLQ-config)
`VIEWER` | `OPERATOR`

### `GlobalRole`
`ADMIN` | `USER`

### `AuthProvider`
`LOCAL` | `OIDC`

### `KafkaSecurityProtocol`
`PLAINTEXT` | `SASL_PLAIN` | `SASL_SCRAM_SHA_256` | `SASL_SCRAM_SHA_512` | `SSL`

---

## Domain Events

| Evento | Trigger | Payload chiave |
|--------|---------|----------------|
| `KafkaClusterRegistered` | Admin registra cluster | clusterId |
| `DlqConfigCreated` | Admin crea DLQ config | dlqConfigId, clusterId |
| `FetchCompleted` | Fine fetch (sched/on-demand) | dlqConfigId, count, latestOffsets |
| `FetchSkipped` | On-demand bloccato da sched in corso | dlqConfigId |
| `MessageIngested` | Nuovo messaggio nel DB | messageId, dlqConfigId |
| `MessageStatusChanged` | Cambio stato messaggio | messageId, oldStatus, newStatus |
| `MessageReplayed` | Replay completato con successo | messageId, targetTopic, replayedBy |
| `ReplayFailed` | Pubblicazione Kafka fallita | messageId, reason |
| `NoteAdded` | Utente aggiunge nota | messageId, noteId, authorId |
| `UserAssignedToDlqConfig` | Admin assegna utente a DLQ | userId, dlqConfigId, role |
| `PartitionReconciled` | Nuova partizione rilevata | dlqConfigId, partition |

---

## Regole di Dominio

1. **ADMIN** ha accesso implicito in lettura e replay a tutte le DLQ config.
2. **VIEWER** può leggere messaggi e aggiungere note su DLQ config a cui è assegnato.
3. **OPERATOR** può fare tutto di VIEWER + eseguire replay + modificare payload prima del replay + fare override del topic di replay.
4. Un fetch on-demand viene rifiutato se un fetch schedulato è in esecuzione sulla stessa DLQ config.
5. L'offset committato non può essere resettato manualmente (nessun re-download).
6. Un nuovo fetch parte da `earliest` per le partizioni mai viste.
7. Se Kafka ha eliminato messaggi prima dell'ultimo offset committato, il sistema logga il gap e riparte dall'earliest disponibile.
8. Il payload modificato prima del replay deve superare la validazione schema prima della conferma.
9. Ogni replay (riuscito o fallito) produce un `ReplayAuditRecord` immutabile.
10. Le credenziali Kafka sono cifrate at-rest (AES-256) con chiave da env var.
11. Il primo utente registrato in modalità standalone diventa automaticamente ADMIN.
12. La retention dei messaggi (per giorni o per count) è configurabile per DLQ config e applicata da un job schedulato.

---

## Architettura Esagonale — Porte principali

### Porte Inbound (Driving)
- `FetchMessagesUseCase` — avvia fetch (schedulato/on-demand)
- `ReplayMessageUseCase` — wizard replay
- `InspectMessagesUseCase` — lista, filtri, dettaglio
- `ManageClusterUseCase` — CRUD cluster + DLQ config
- `ManageUsersUseCase` — CRUD utenti, assegnazione ruoli
- `AddNoteUseCase` — aggiunta nota a messaggio

### Porte Outbound (Driven)
- `KafkaConsumerPort` — fetch messaggi da topic Kafka
- `KafkaProducerPort` — pubblicazione messaggio su topic
- `SchemaRegistryPort` — decode/encode payload, validazione schema
- `MessageRepository` — persistenza DlqMessage
- `DlqConfigRepository` — persistenza DlqConfig
- `UserRepository` — persistenza User
- `AuditRepository` — persistenza ReplayAuditRecord
- `NotificationPort` — invio eventi SSE al frontend
- `EncryptionPort` — cifratura/decifratura credenziali
