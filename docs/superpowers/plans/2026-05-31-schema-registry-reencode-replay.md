# Schema Registry Re-encode on Replay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When replaying an edited payload whose original message was Avro or JSON-Schema encoded, re-encode it into the Confluent wire format before publishing so downstream consumers don't receive malformed bytes.

**Architecture:** Add `encode()` to `SchemaRegistryPort`; implement per-format encoding in `ConfluentSchemaRegistryAdapter` (AVRO: JSON→GenericRecord→binary+wire-header; JSON: wrap in wire-header; PROTOBUF: throws); `ReplayMessageUseCase` calls `encode()` when `schemaId != null` and SR is configured, otherwise falls back to plain UTF-8. Also fix a frontend bug where the wizard "Next" button skips the edit-payload step entirely.

**Tech Stack:** Quarkus 3.x, Apache Avro (`GenericDatumReader`/`GenericDatumWriter`, `JsonDecoder`, `EncoderFactory`), Confluent Schema Registry client (`MockSchemaRegistryClient` in tests), JUnit 5 + Mockito + AssertJ, React + TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `backend/src/main/java/it/dls/domain/shared/SchemaRegistryPort.java` | Add `encode()` method |
| `backend/src/main/java/it/dls/infrastructure/schemaregistry/JsonSchemaRegistryAdapter.java` | Implement `encode()` as UTF-8 passthrough |
| `backend/src/main/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapter.java` | Implement `encode()` for AVRO, JSON, PROTOBUF |
| `backend/src/main/java/it/dls/application/replay/ReplayMessageUseCase.java` | Use `encode()` in payload resolution |
| `backend/src/test/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapterIT.java` | Add encode tests (SR-007, SR-008, SR-009) |
| `backend/src/test/java/it/dls/application/replay/ReplayMessageUseCaseTest.java` | Update + extend replay payload tests |
| `frontend/src/pages/messages/ReplayWizard.tsx` | Fix "Next" skipping edit step; remove redundant button |

---

## Task 1: Add `encode()` to `SchemaRegistryPort` and `JsonSchemaRegistryAdapter`

**Files:**
- Modify: `backend/src/main/java/it/dls/domain/shared/SchemaRegistryPort.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/schemaregistry/JsonSchemaRegistryAdapter.java`

- [ ] **Step 1: Add `encode()` signature to the port**

Replace the contents of `SchemaRegistryPort.java`:

```java
package it.dls.domain.shared;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;

public interface SchemaRegistryPort {

    DecodedPayload decode(byte[] rawPayload, String schemaRegistryUrl,
                          SchemaRegistryAuthConfig auth);

    ValidationResult validate(JsonNode payload, int schemaId,
                               String schemaRegistryUrl, SchemaRegistryAuthConfig auth);

    byte[] encode(JsonNode payload, int schemaId,
                  String schemaRegistryUrl, SchemaRegistryAuthConfig auth);
}
```

- [ ] **Step 2: Implement `encode()` in `JsonSchemaRegistryAdapter`**

Replace the contents of `JsonSchemaRegistryAdapter.java`:

```java
package it.dls.infrastructure.schemaregistry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.shared.DecodedPayload;
import it.dls.domain.shared.SchemaRegistryPort;
import it.dls.domain.shared.ValidationResult;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

import java.nio.charset.StandardCharsets;

@DefaultBean
@ApplicationScoped
public class JsonSchemaRegistryAdapter implements SchemaRegistryPort {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public DecodedPayload decode(byte[] rawPayload, String schemaRegistryUrl,
                                  SchemaRegistryAuthConfig auth) {
        try {
            JsonNode node = MAPPER.readTree(rawPayload);
            return new DecodedPayload(node, null, "PLAIN_JSON");
        } catch (Exception e) {
            throw new RuntimeException("Failed to decode payload as JSON: " + e.getMessage(), e);
        }
    }

    @Override
    public ValidationResult validate(JsonNode payload, int schemaId,
                                      String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        return ValidationResult.ok();
    }

    @Override
    public byte[] encode(JsonNode payload, int schemaId,
                         String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        return payload.toString().getBytes(StandardCharsets.UTF_8);
    }
}
```

- [ ] **Step 3: Verify the project compiles**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew compileJava -x test
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/it/dls/domain/shared/SchemaRegistryPort.java \
        backend/src/main/java/it/dls/infrastructure/schemaregistry/JsonSchemaRegistryAdapter.java
git commit -m "feat(schema-registry): add encode() to SchemaRegistryPort, implement UTF-8 passthrough in JsonSchemaRegistryAdapter"
```

---

## Task 2: Implement `encode()` in `ConfluentSchemaRegistryAdapter` (JSON_SCHEMA + AVRO + PROTOBUF)

**Files:**
- Modify: `backend/src/main/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapter.java`
- Modify: `backend/src/test/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapterIT.java`

**Background:** The Confluent wire format is `[0x00][4-byte big-endian schemaId][payload bytes]`. For AVRO, the payload bytes are Avro binary-encoded. For JSON_SCHEMA, the payload bytes are UTF-8 JSON. `JsonDecoder` + `GenericDatumReader` convert a JSON string to a `GenericRecord`; `GenericDatumWriter` + `BinaryEncoder` serialize it back.

- [ ] **Step 1: Write the failing tests (SR-007, SR-008, SR-009)**

Add these three tests to `ConfluentSchemaRegistryAdapterIT.java`, inside the class, after the existing `unknownSchemaId_returnsFailed` test:

```java
// SR-007
@Test
void encodeAvroPayload_producesValidConfluentWireFormat() throws Exception {
    var avroSchema = new org.apache.avro.Schema.Parser().parse(
        """
        {"type":"record","name":"Order","namespace":"it.dls",
         "fields":[{"name":"id","type":"string"},{"name":"amount","type":"double"}]}
        """
    );
    int schemaId = mockClient.register("order-value", new AvroSchema(avroSchema));
    var payload = MAPPER.readTree("{\"id\":\"ord-enc\",\"amount\":77.5}");

    byte[] encoded = adapter.encode(payload, schemaId, "http://mock-sr", SchemaRegistryAuthConfig.none());

    // Wire format header: magic byte 0x00 + 4-byte schemaId
    assertThat(encoded[0]).isEqualTo((byte) 0x00);
    assertThat(ByteBuffer.wrap(encoded, 1, 4).getInt()).isEqualTo(schemaId);

    // Round-trip: decode the encoded bytes and check field values
    DecodedPayload decoded = adapter.decode(encoded, "http://mock-sr", SchemaRegistryAuthConfig.none());
    assertThat(decoded.isDecoded()).isTrue();
    assertThat(decoded.format()).isEqualTo("AVRO");
    assertThat(decoded.payload().get("id").asText()).isEqualTo("ord-enc");
    assertThat(decoded.payload().get("amount").asDouble()).isEqualTo(77.5);
}

// SR-008
@Test
void encodeJsonSchemaPayload_producesConfluentWireHeader() throws Exception {
    var jsonSchema = new io.confluent.kafka.schemaregistry.json.JsonSchema(
        """
        {"type":"object","properties":{"orderId":{"type":"string"},"total":{"type":"number"}}}
        """
    );
    int schemaId = mockClient.register("order-json-value", jsonSchema);
    var payload = MAPPER.readTree("{\"orderId\":\"j-enc\",\"total\":55.0}");

    byte[] encoded = adapter.encode(payload, schemaId, "http://mock-sr", SchemaRegistryAuthConfig.none());

    assertThat(encoded[0]).isEqualTo((byte) 0x00);
    assertThat(ByteBuffer.wrap(encoded, 1, 4).getInt()).isEqualTo(schemaId);
    String jsonPart = new String(encoded, 5, encoded.length - 5, java.nio.charset.StandardCharsets.UTF_8);
    assertThat(MAPPER.readTree(jsonPart).get("orderId").asText()).isEqualTo("j-enc");
    assertThat(MAPPER.readTree(jsonPart).get("total").asDouble()).isEqualTo(55.0);
}

// SR-009
@Test
void encodeProtobufSchema_throwsUnsupportedOperationException() throws Exception {
    // Protobuf encode is blocked (same binary incompatibility as decode)
    var protoSchema = new io.confluent.kafka.schemaregistry.protobuf.ProtobufSchema(
        "syntax = \"proto3\"; message Order { string id = 1; }"
    );
    int schemaId;
    try {
        schemaId = mockClient.register("order-proto-value", protoSchema);
    } catch (Throwable t) {
        // If even registration fails due to binary incompatibility, test is vacuously valid
        return;
    }
    var payload = MAPPER.readTree("{\"id\":\"proto-enc\"}");

    assertThatThrownBy(() -> adapter.encode(payload, schemaId, "http://mock-sr", SchemaRegistryAuthConfig.none()))
        .isInstanceOf(UnsupportedOperationException.class)
        .hasMessageContaining("Protobuf");
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeAvroPayload_producesValidConfluentWireFormat" \
               --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeJsonSchemaPayload_producesConfluentWireHeader" \
               --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeProtobufSchema_throwsUnsupportedOperationException" \
               -i 2>&1 | tail -20
```

Expected: 3 failures with `AbstractMethodError` or similar (method not implemented yet).

- [ ] **Step 3: Implement `encode()` in `ConfluentSchemaRegistryAdapter`**

Add the following imports to `ConfluentSchemaRegistryAdapter.java` (after the existing imports):

```java
import org.apache.avro.generic.GenericDatumWriter;
import org.apache.avro.io.EncoderFactory;
import java.io.ByteArrayOutputStream;
```

Add the following method to `ConfluentSchemaRegistryAdapter.java` (after the existing `validate()` method, before `buildClient()`):

```java
@Override
public byte[] encode(JsonNode payload, int schemaId,
                     String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
    try {
        var client = buildClient(schemaRegistryUrl, auth);
        var schema = client.getSchemaById(schemaId);
        return switch (schema.schemaType()) {
            case "AVRO"     -> encodeAvro(payload, (AvroSchema) schema, schemaId);
            case "JSON"     -> encodeJsonSchema(payload, schemaId);
            case "PROTOBUF" -> throw new UnsupportedOperationException(
                                   "Protobuf encode not supported — blocked on Confluent 8.x upgrade");
            default -> payload.toString().getBytes(StandardCharsets.UTF_8);
        };
    } catch (UnsupportedOperationException e) {
        throw e;
    } catch (Exception e) {
        throw new RuntimeException("Encode failed for schemaId=" + schemaId + ": " + e.getMessage(), e);
    }
}

private byte[] encodeAvro(JsonNode payload, AvroSchema schema, int schemaId) throws Exception {
    var avroSchema = schema.rawSchema();
    var reader = new GenericDatumReader<GenericRecord>(avroSchema);
    var decoder = DecoderFactory.get().jsonDecoder(avroSchema, payload.toString());
    var record = reader.read(null, decoder);

    var baos = new ByteArrayOutputStream();
    baos.write(0x00);
    baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
    var encoder = EncoderFactory.get().binaryEncoder(baos, null);
    new GenericDatumWriter<GenericRecord>(avroSchema).write(record, encoder);
    encoder.flush();
    return baos.toByteArray();
}

private byte[] encodeJsonSchema(JsonNode payload, int schemaId) throws Exception {
    var baos = new ByteArrayOutputStream();
    baos.write(0x00);
    baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
    baos.write(payload.toString().getBytes(StandardCharsets.UTF_8));
    return baos.toByteArray();
}
```

- [ ] **Step 4: Run the three new tests and confirm they pass**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeAvroPayload_producesValidConfluentWireFormat" \
               --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeJsonSchemaPayload_producesConfluentWireHeader" \
               --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT.encodeProtobufSchema_throwsUnsupportedOperationException" \
               -i 2>&1 | tail -20
```

Expected: `3 tests completed, 0 failures`

- [ ] **Step 5: Run the full adapter IT suite to ensure no regressions**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test --tests "it.dls.infrastructure.schemaregistry.ConfluentSchemaRegistryAdapterIT" -i 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapter.java \
        backend/src/test/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapterIT.java
git commit -m "feat(schema-registry): implement encode() in ConfluentSchemaRegistryAdapter for AVRO and JSON_SCHEMA"
```

---

## Task 3: Update `ReplayMessageUseCase` to call `encode()`

**Files:**
- Modify: `backend/src/main/java/it/dls/application/replay/ReplayMessageUseCase.java`
- Modify: `backend/src/test/java/it/dls/application/replay/ReplayMessageUseCaseTest.java`

**Background:** The current payload resolution is a single ternary on line 58–60. Replace it with a three-branch block. `encode()` is called **after** the existing schema validation (lines 49–55), so by the time we reach it the payload has already passed `validate()`. Any `RuntimeException` from `encode()` falls into the existing catch block → `REPLAY_FAILED` + audit record.

- [ ] **Step 1: Write failing tests for new payload-resolution cases**

In `ReplayMessageUseCaseTest.java`, replace the existing `editedPayload_withValidSchema_sendsEditedBytes` test and add two new tests:

```java
@Test
void editedPayload_withSchemaAndSR_callsEncodeAndSendsResult() throws Exception {
    var mapper = new ObjectMapper();
    var edited = mapper.readTree("{\"amount\":50.00}");
    var encoded = new byte[]{0x00, 0x00, 0x00, 0x00, 0x07, 0x42}; // fake encoded bytes
    var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
        Map.of("x-original-topic", "orders"), 7);
    var config = config(CONFIG_ID, CLUSTER_ID);
    var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
    when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
    when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
    when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
    when(schemaRegistry.validate(any(), eq(7), any(), any())).thenReturn(ValidationResult.ok());
    when(schemaRegistry.encode(eq(edited), eq(7), any(), any())).thenReturn(encoded);

    var result = useCase.replay(MSG_ID, null, edited, USER_ID);

    assertThat(result.success()).isTrue();
    verify(schemaRegistry).encode(eq(edited), eq(7), any(), any());
    var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
    verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
    assertThat(payloadCaptor.getValue()).isEqualTo(encoded);
}

@Test
void editedPayload_noSR_sendsUtf8Json() throws Exception {
    var mapper = new ObjectMapper();
    var edited = mapper.readTree("{\"amount\":50.00}");
    var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
        Map.of("x-original-topic", "orders"), null);
    var config = config(CONFIG_ID, CLUSTER_ID);
    var cluster = plaintextCluster(CLUSTER_ID); // no SR
    when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
    when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
    when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

    var result = useCase.replay(MSG_ID, null, edited, USER_ID);

    assertThat(result.success()).isTrue();
    verify(schemaRegistry, never()).encode(any(), anyInt(), any(), any());
    var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
    verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
    assertThat(new String(payloadCaptor.getValue(), java.nio.charset.StandardCharsets.UTF_8))
        .contains("50.0");
}

@Test
void noEditedPayload_sendsRawPayload() {
    var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
        Map.of("x-original-topic", "orders"), 7);
    var config = config(CONFIG_ID, CLUSTER_ID);
    var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
    when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
    when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
    when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

    useCase.replay(MSG_ID, null, null, USER_ID);

    verify(schemaRegistry, never()).encode(any(), anyInt(), any(), any());
    var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
    verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
    assertThat(payloadCaptor.getValue()).isEqualTo(new byte[]{1, 2, 3}); // rawPayload from message()
}

@Test
void encodeFailure_transitionsToReplayFailed() throws Exception {
    var mapper = new ObjectMapper();
    var edited = mapper.readTree("{\"amount\":50.00}");
    var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
        Map.of("x-original-topic", "orders"), 7);
    var config = config(CONFIG_ID, CLUSTER_ID);
    var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
    when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
    when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
    when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
    when(schemaRegistry.validate(any(), eq(7), any(), any())).thenReturn(ValidationResult.ok());
    when(schemaRegistry.encode(any(), eq(7), any(), any()))
        .thenThrow(new RuntimeException("Encode failed: schema mismatch"));

    var result = useCase.replay(MSG_ID, null, edited, USER_ID);

    assertThat(result.success()).isFalse();
    assertThat(result.failureReason()).contains("Encode failed");
    assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAY_FAILED);
    verify(auditRepo).save(any(ReplayAuditRecord.class));
    verify(notifier).emitMessageStatusChanged(MSG_ID, CONFIG_ID, "REPLAY_FAILED");
}
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test --tests "it.dls.application.replay.ReplayMessageUseCaseTest.editedPayload_withSchemaAndSR_callsEncodeAndSendsResult" \
               --tests "it.dls.application.replay.ReplayMessageUseCaseTest.editedPayload_noSR_sendsUtf8Json" \
               --tests "it.dls.application.replay.ReplayMessageUseCaseTest.noEditedPayload_sendsRawPayload" \
               --tests "it.dls.application.replay.ReplayMessageUseCaseTest.encodeFailure_transitionsToReplayFailed" \
               -i 2>&1 | tail -20
```

Expected: failures (encode() not called yet in use case).

- [ ] **Step 3: Replace payload resolution in `ReplayMessageUseCase`**

In `ReplayMessageUseCase.java`, replace lines 58–60:

```java
// REMOVE:
var payload = editedPayload != null
    ? editedPayload.toString().getBytes(StandardCharsets.UTF_8)
    : msg.getRawPayload();
```

With:

```java
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

- [ ] **Step 4: Run the full use case test suite**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test --tests "it.dls.application.replay.ReplayMessageUseCaseTest" -i 2>&1 | tail -20
```

Expected: all tests pass (including updated + new ones).

- [ ] **Step 5: Run full backend test suite**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/backend
./gradlew test 2>&1 | tail -30
```

Expected: `BUILD SUCCESSFUL`, no failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/it/dls/application/replay/ReplayMessageUseCase.java \
        backend/src/test/java/it/dls/application/replay/ReplayMessageUseCaseTest.java
git commit -m "feat(replay): re-encode edited payload with schema registry wire format before publish"
```

---

## Task 4: Fix `ReplayWizard` — "Next" skips edit step

**Files:**
- Modify: `frontend/src/pages/messages/ReplayWizard.tsx`

**Background:** On step `review`, the "Next" button calls `setStep('confirm')`, skipping the `edit` step entirely. The "Edit Payload" button is the only way to reach `edit`, but it's a secondary CTA most users miss. Fix: "Next" goes to `edit` when `hasDecodedPayload` is true, to `confirm` otherwise. Remove the now-redundant "Edit Payload" button.

- [ ] **Step 1: Fix the "Next" button and remove the redundant "Edit Payload" button**

In `ReplayWizard.tsx`, replace the `DialogFooter` block inside `step === 'review'` (lines 153–171):

```tsx
// REMOVE:
<DialogFooter>
  <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
  {hasDecodedPayload && (
    <button
      className="btn btn-secondary"
      onClick={() => setStep('edit')}
      disabled={!effectiveTopic}
    >
      Edit Payload
    </button>
  )}
  <button
    className="btn btn-primary"
    onClick={() => setStep('confirm')}
    disabled={!effectiveTopic}
  >
    Next
  </button>
</DialogFooter>
```

With:

```tsx
<DialogFooter>
  <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
  <button
    className="btn btn-primary"
    onClick={() => setStep(hasDecodedPayload ? 'edit' : 'confirm')}
    disabled={!effectiveTopic}
  >
    Next
  </button>
</DialogFooter>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/frontend
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run Playwright tests that cover replay**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society/frontend
npx playwright test --grep "replay" 2>&1 | tail -30
```

Expected: all replay tests pass. If any test explicitly clicks "Edit Payload" button, update it to click "Next" instead.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/messages/ReplayWizard.tsx
git commit -m "fix(replay-wizard): Next button now navigates to edit step when payload is decodable"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `encode()` added to `SchemaRegistryPort` — Task 1
- ✅ AVRO encode (JSON→GenericRecord→binary+wire-header) — Task 2
- ✅ JSON_SCHEMA encode (wrap in wire-header) — Task 2
- ✅ PROTOBUF throws `UnsupportedOperationException` — Task 2
- ✅ `JsonSchemaRegistryAdapter` returns UTF-8 passthrough — Task 1
- ✅ `ReplayMessageUseCase` calls `encode()` when `schemaId != null && SR != null` — Task 3
- ✅ Falls back to plain UTF-8 when no SR — Task 3
- ✅ Falls back to `rawPayload` when no edit — Task 3
- ✅ Encode failure → `REPLAY_FAILED` + audit — Task 3 (test `encodeFailure_transitionsToReplayFailed`)
- ✅ Frontend wizard bug (edit step skipped) — Task 4
- ✅ `BulkReplayUseCase` not touched (no edit concept, uses rawPayload) — correct

**No placeholders:** All steps contain exact code, exact commands, exact expected output.

**Type consistency:** `encode()` signature is identical across port, both adapters, and use case call sites.
