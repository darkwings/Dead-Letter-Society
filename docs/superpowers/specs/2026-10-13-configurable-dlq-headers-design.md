# Configurable DLQ Headers — Design

## Problem

Dead-letter header names are framework-specific (Spring Kafka, Quarkus SmallRye, custom). Today only `x-original-topic` is understood and it is hardcoded in `ReplayTopicResolver`, `MessageDetailPage.tsx` and `MessageListPage.tsx`. `KafkaConsumerAdapter` decodes every header value as a UTF-8 string, which garbles binary values (Spring writes original partition/offset/timestamp as int32/int64 bytes).

## Goal

Per-DLQ configurable header mapping, with presets (Spring, Quarkus SmallRye, Legacy, Custom), used for replay-topic resolution and for a normalized "Failure info" view.

## Decisions

- Mapping lives on **DlqConfig** (not cluster, not global): one cluster can host services using different frameworks.
- Presets are **code-defined** (domain registry). Choosing a preset *copies* its values into the config; later preset changes in code never silently alter existing configs.
- Raw headers stay untouched and are preserved in full on Replay.
- Existing configs migrate to the `LEGACY` preset (`x-original-topic`) → behavior unchanged.

## Domain

`HeaderMapping` value object (immutable, no framework deps). Each field is an optional header name plus, where needed, an encoding:

| Field | Encoding |
|-------|----------|
| `originalTopic` | STRING |
| `originalPartition` | STRING \| INT32 |
| `originalOffset` | STRING \| INT64 |
| `originalTimestamp` | STRING \| INT64 (epoch ms) |
| `exceptionMessage` | STRING |
| `exceptionStacktrace` | STRING |

`HeaderPreset` enum: `LEGACY`, `SPRING`, `QUARKUS_SMALLRYE`, `CUSTOM`. `HeaderPreset.mapping()` returns the preset's `HeaderMapping` (`CUSTOM` → empty).

| Preset | topic | partition | offset | timestamp | message | stacktrace |
|--------|-------|-----------|--------|-----------|---------|------------|
| LEGACY | `x-original-topic` | – | – | – | `x-exception-message` | – |
| SPRING | `kafka_dlt-original-topic` | `kafka_dlt-original-partition` (INT32) | `kafka_dlt-original-offset` (INT64) | `kafka_dlt-original-timestamp` (INT64) | `kafka_dlt-exception-message` | `kafka_dlt-exception-stacktrace` |
| QUARKUS_SMALLRYE | `dead-letter-topic` | `dead-letter-partition` | `dead-letter-offset` | – | `dead-letter-reason` | `dead-letter-cause` |

Names/encodings verified on 2026-10-13 against the Spring Kafka (`DeadLetterPublishingRecoverer`) and SmallRye Reactive Messaging (`dead-letter-queue` strategy) docs. SmallRye writes partition/offset as strings and has no timestamp header; Spring writes int32/int64 binary. Tests pin the values.

`DlqConfig` gains `headerPreset` and `headerMapping` (non-null; default `LEGACY`).

## Persistence

Flyway **V10**: `dlq_configs.header_preset VARCHAR NOT NULL DEFAULT 'LEGACY'`, `dlq_configs.header_mapping JSONB NOT NULL` (backfilled with the LEGACY mapping). Mapping format follows the existing JSONB convention (`mapping.format.global=ignore`).

## Ingestion

- `RawKafkaMessage.headers` becomes `Map<String, byte[]>`; the adapter stops stringifying.
- Persisted `headers` JSONB stays `Map<String,String>`. Conversion rule in the use case: header named in the mapping with INT32/INT64 encoding → decimal string of the decoded number; any other header → UTF-8 string (as today). Raw binary is therefore not kept; this is a deliberate simplification (Replay re-publishes the stored strings, as today).
- Undecodable value (wrong length) → stored as base64 with no failure; extractor yields null for that field.

## Application

- `FailureInfoExtractor.extract(DlqMessage, HeaderMapping) → FailureInfo` (all fields nullable). Pure, no I/O.
- `ReplayTopicResolver`: `config.getHeaderMapping().originalTopic()` replaces the constant. Priority order unchanged (wizard override → config default → header).
- `TERMS.md` / `DOMAIN.md` updated (Headers, Replay Topic, new term *Header Mapping*).

## API

- DlqConfig create/update/get DTOs: `headerPreset`, `headerMapping`. Validation: preset ≠ CUSTOM ⇒ mapping ignored and replaced by preset's; CUSTOM ⇒ header names non-blank when present, encodings limited to allowed values per field.
- `MessageResponse` adds `failureInfo` (`originalTopic`, `originalPartition`, `originalOffset`, `originalTimestamp`, `exceptionMessage`, `exceptionStacktrace`). Raw `headers` still returned.

## Frontend

- Create/Edit DlqConfig: preset dropdown; selecting a preset fills read-only fields; `CUSTOM` makes them editable.
- `MessageDetailPage`: "Failure" panel from `failureInfo`; replay wizard's `resolvedTopic` uses `failureInfo.originalTopic`.
- `MessageListPage`: bulk-replay eligibility uses `failureInfo.originalTopic` instead of the hardcoded header.
- Types hand-written, co-located (project convention).

## Testing (per EVALUATION.md)

- Unit: `HeaderMapping`/`HeaderPreset` (pinned preset values), `FailureInfoExtractor` (STRING/INT32/INT64, missing, malformed), `ReplayTopicResolver` per preset and CUSTOM.
- Use case: ingestion header conversion with binary Spring-style headers.
- Integration: V10 migration backfills LEGACY on pre-existing rows; DlqConfig REST round-trip with each preset; validation errors for bad CUSTOM mappings.
- E2E (Playwright, mock `/api/events`): preset switch in config form; Failure panel rendering; replay topic resolved from non-legacy preset.

## Out of scope

Per-message mapping overrides, user-defined named presets stored in DB, retaining raw binary header bytes, re-extracting already-ingested messages with a changed mapping (stored strings are used as-is).
