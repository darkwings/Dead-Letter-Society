# Schema Registry Re-encode on Replay

**Date:** 2026-05-31
**Status:** Approved

## Problem

When a user edits a payload in the Replay Wizard and submits, `ReplayMessageUseCase` currently serializes the edited `JsonNode` as plain UTF-8 JSON bytes regardless of the original wire format. If the original message was AVRO or JSON Schema encoded (Confluent wire format: `0x00` + 4-byte schema-id prefix), the replayed message is malformed and the downstream consumer breaks.

## Scope

- Fix `ReplayMessageUseCase` only — `BulkReplayUseCase` always uses `rawPayload` (no edit), not affected.
- No DB migration required.
- PROTOBUF encode remains unsupported (same as decode — binary incompatibility with protobuf-java 4.x in Quarkus BOM).

## Design

### Port: `SchemaRegistryPort`

Add one method:

```java
byte[] encode(JsonNode payload, int schemaId, String schemaRegistryUrl, SchemaRegistryAuthConfig auth);
```

### Adapter: `ConfluentSchemaRegistryAdapter.encode()`

1. Fetch schema from SR by `schemaId`.
2. Switch on `schema.schemaType()`:
   - **AVRO**: parse `payload.toString()` via `JsonDecoder` + `GenericDatumReader<GenericRecord>`, then serialize with `GenericDatumWriter` + `BinaryEncoder` into a `ByteArrayOutputStream`. Prepend Confluent wire header: `[0x00][4-byte big-endian schemaId]`.
   - **JSON**: prepend `[0x00][4-byte big-endian schemaId]` + `payload.toString().getBytes(UTF-8)`.
   - **PROTOBUF**: throw `UnsupportedOperationException("Protobuf encode not supported")`.
   - **default**: return `payload.toString().getBytes(UTF-8)`.
3. Any exception propagates as `RuntimeException` → caught by existing try/catch in `ReplayMessageUseCase` → `REPLAY_FAILED` + audit record.

### Adapter: `JsonSchemaRegistryAdapter.encode()`

Returns `payload.toString().getBytes(UTF-8)` — no SR, no wire format.

### Use case: `ReplayMessageUseCase.replay()`

Replace current payload resolution:

```java
// before
var payload = editedPayload != null
    ? editedPayload.toString().getBytes(StandardCharsets.UTF_8)
    : msg.getRawPayload();
```

```java
// after
byte[] payload;
if (editedPayload != null) {
    if (msg.getSchemaId() != null && cluster.getSchemaRegistry() != null) {
        var srAuth = cluster.getSchemaRegistry().authConfig().decrypted(encryption);
        payload = schemaRegistry.encode(editedPayload, msg.getSchemaId(),
            cluster.getSchemaRegistry().url(), srAuth);
    } else {
        payload = editedPayload.toString().getBytes(StandardCharsets.UTF_8);
    }
} else {
    payload = msg.getRawPayload();
}
```

The `encode()` call happens **after** the existing `validate()` call (lines 49–55), so by the time we encode, the payload has already passed schema validation.

## Error Handling

Encode failure (e.g., JSON fields incompatible with Avro schema at serialization time, SR unreachable) throws `RuntimeException`. The existing catch block in `replay()` catches it, transitions message to `REPLAY_FAILED`, saves an audit record with the error message, and emits SSE notification — same as any other publish failure. No additional error path needed.

## Files Changed

| File | Change |
|------|--------|
| `domain/shared/SchemaRegistryPort.java` | Add `encode()` method |
| `infrastructure/schemaregistry/ConfluentSchemaRegistryAdapter.java` | Implement `encode()` |
| `infrastructure/schemaregistry/JsonSchemaRegistryAdapter.java` | Implement `encode()` (UTF-8 passthrough) |
| `application/replay/ReplayMessageUseCase.java` | Use `encode()` when schemaId + SR available |

## Tests

### New: `ConfluentSchemaRegistryAdapterEncodeTest`

- AVRO: encode round-trip — encode then decode, verify output matches input `JsonNode`
- JSON_SCHEMA: verify output starts with `[0x00]` + schemaId bytes + original JSON bytes
- PROTOBUF: verify `UnsupportedOperationException` thrown

### Updated: `ReplayMessageUseCaseTest`

Three cases for payload resolution:
1. `editedPayload != null`, `schemaId != null`, SR configured → `schemaRegistry.encode()` called
2. `editedPayload != null`, no SR → `editedPayload.toString().getBytes(UTF-8)` used
3. `editedPayload == null` → `msg.getRawPayload()` used

## Out of Scope

- Strengthening `validate()` to check JSON structure against Avro schema (not just schema existence) — separate improvement.
- PROTOBUF encode support — blocked on Confluent 8.x upgrade.
- Frontend changes — no UI change needed; the wizard already sends `editedPayload` and shows `REPLAY_FAILED` status on error.
