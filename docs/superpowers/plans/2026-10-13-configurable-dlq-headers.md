# Configurable DLQ Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each DLQ Config declare which Kafka headers carry original topic / partition / offset / timestamp / exception message / stacktrace, via presets (Legacy, Spring, Quarkus SmallRye) or a custom mapping.

**Architecture:** A `HeaderMapping` value object + `HeaderPreset` enum in `domain/dlqconfig`, stored on `DlqConfig` (JSONB column, migration V10). Ingestion decodes binary headers (INT32/INT64) to decimal strings using the mapping; a pure `FailureInfoExtractor` derives a normalized `FailureInfo` from stored headers. `ReplayTopicResolver`, the message API (`failureInfo`) and the frontend read the mapping instead of the hardcoded `x-original-topic`.

**Tech Stack:** Quarkus 3 (JAX-RS, Panache, Flyway, Jackson), JUnit5 + AssertJ + Mockito, React + TypeScript + TanStack Query + react-hook-form/zod, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-configurable-dlq-headers-design.md`

## Global Constraints

- Hexagonal: `domain/` has no framework imports (no Jackson annotations, no CDI); `application/` injects ports; REST/Panache only in `infrastructure/`.
- Raw `headers` stay `Map<String,String>` in DB/API; Replay keeps republishing stored headers + `x-dls-replayed-at` / `x-dls-replayed-by`.
- Existing DlqConfigs must behave exactly as before: migration backfills `LEGACY` (`x-original-topic`).
- `DlqConfig.create(...)` and the existing `reconstitute(...)` overloads keep their signatures (default preset `LEGACY`), so existing tests keep compiling.
- Replay topic priority unchanged: wizard override → config `defaultReplayTopic` → mapped original-topic header.
- Frontend types hand-written, co-located with pages (no generated client); single `apiFetch<T>`.
- E2E tests that open `MessageDetailPage` must mock `/api/events`; use `loginAsAdmin/Operator/Viewer` from `e2e/helpers/auth.ts`.
- Missing or unmappable headers must never fail ingestion, message viewing or the UI. When the replay topic cannot be derived, the user can always supply it: single replay via the wizard's topic override (existing), bulk replay via a new optional `targetTopicOverride`. Neither replay button is disabled just because no topic could be inferred.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Backend tests: `cd backend && ./gradlew test --tests '<pattern>'`. Playwright: `cd frontend && npx playwright test <file>`.

## Review Focus

- Spring int32 header with wrong byte length (e.g. 3 bytes) → no crash; stored as base64; extractor yields `null` for that field. (Task 4, Task 2)
- Mapping field present in config but header absent on message → `FailureInfo` field `null`, not an error. (Task 2)
- Header value non-numeric where a number is expected (CUSTOM STRING partition `"abc"`) → field `null`, no exception. (Task 2)
- Config deleted / missing when assembling a message page → `FailureInfo.empty()`, endpoint still 200. (Task 6)
- CUSTOM preset with blank header name or disallowed encoding (e.g. `originalTopic` with INT32) → 400. (Task 5)
- Existing config rows after V10 → `LEGACY`, `x-original-topic` still resolves replay topic. (Task 3)
- Message ingested with no headers at all (or none of the mapped ones) under any preset → ingested normally, `failureInfo` all null, replay possible with an explicit topic (single and bulk). (Task 4, Task 6, Task 8)

---

## File Structure

**Create (backend)**
- `domain/dlqconfig/HeaderEncoding.java` — enum STRING/INT32/INT64
- `domain/dlqconfig/HeaderField.java` — record(name, encoding)
- `domain/dlqconfig/HeaderMapping.java` — record of 6 optional fields, validation, `binaryEncodings()`
- `domain/dlqconfig/HeaderPreset.java` — enum + `mapping()`
- `domain/message/FailureInfo.java` — normalized failure record
- `application/inspection/FailureInfoExtractor.java` — pure extraction
- `application/inspection/FailureInfoAssembler.java` — loads mappings per config, builds map messageId→FailureInfo
- `application/fetch/HeaderDecoder.java` — `Map<String,byte[]>` → `Map<String,String>` using mapping
- `resources/db/migration/V10__header_mapping.sql`
- `infrastructure/api/cluster/HeaderPresetResource.java` — `GET /api/header-presets`
- tests alongside each (see tasks)

**Modify (backend)**: `DlqConfig`, `DlqConfigEntity`, `DlqConfigRepositoryAdapter`, `RawKafkaMessage`, `KafkaConsumerAdapter`, `FetchMessagesUseCase`, `ReplayTopicResolver`, `ReplayTopicNotResolvableException`, `CreateDlqConfigCommand`, `UpdateDlqConfigCommand`, `ManageDlqConfigUseCase`, `CreateDlqConfigRequest`, `UpdateDlqConfigRequest`, `DlqConfigResponse`, `ClusterResource`, `MessageResponse`, `MessagePageResponse`, `MessageResource`, `DlqConfigMessagesResource`, `AllMessagesResource`.

**Frontend**: create `src/components/HeaderMappingFields.tsx`; modify `CreateDlqConfigPage.tsx`, `EditDlqConfigPage.tsx`, `MessageDetailPage.tsx`, `MessageListPage.tsx`; e2e specs under `e2e/dlqconfig/`, `e2e/messages/`, `e2e/replay/`.

**Docs**: `TERMS.md`, `DOMAIN.md`, `EVALUATION.md`, `CLAUDE.md`.

Package root for backend main: `backend/src/main/java/it/dls/`, tests: `backend/src/test/java/it/dls/`.

---

### Task 1: Header mapping domain (value objects, presets, failure info extraction)

**Files:**
- Create: `domain/dlqconfig/HeaderEncoding.java`, `HeaderField.java`, `HeaderMapping.java`, `HeaderPreset.java`
- Create: `domain/message/FailureInfo.java`
- Create: `application/inspection/FailureInfoExtractor.java`
- Test: `domain/dlqconfig/HeaderMappingTest.java`, `domain/dlqconfig/HeaderPresetTest.java`, `application/inspection/FailureInfoExtractorTest.java`

**Interfaces:**
- Produces:
  - `enum HeaderEncoding { STRING, INT32, INT64 }`
  - `record HeaderField(String name, HeaderEncoding encoding)` — name non-blank, encoding non-null (defaults STRING if null)
  - `record HeaderMapping(HeaderField originalTopic, HeaderField originalPartition, HeaderField originalOffset, HeaderField originalTimestamp, HeaderField exceptionMessage, HeaderField exceptionStacktrace)`; `static HeaderMapping empty()`; `Map<String,HeaderEncoding> binaryEncodings()` (only INT32/INT64 entries, keyed by header name). Compact ctor throws `IllegalArgumentException` if `originalTopic`/`exceptionMessage`/`exceptionStacktrace` encoding ≠ STRING, `originalPartition` encoding = INT64, or `originalOffset`/`originalTimestamp` encoding = INT32.
  - `enum HeaderPreset { LEGACY, SPRING, QUARKUS_SMALLRYE, CUSTOM }` with `HeaderMapping mapping()`
  - `record FailureInfo(String originalTopic, Integer originalPartition, Long originalOffset, Instant originalTimestamp, String exceptionMessage, String exceptionStacktrace)`; `static FailureInfo empty()`
  - `final class FailureInfoExtractor { FailureInfo extract(Map<String,String> headers, HeaderMapping mapping) }`

- [ ] **Step 1: Verify framework header names**

Check the current docs/source and confirm the names and encodings used below. Spring Kafka `DeadLetterPublishingRecoverer` (`KafkaHeaders.DLT_ORIGINAL_TOPIC` = `kafka_dlt-original-topic`, `..._PARTITION` int32 big-endian, `..._OFFSET` int64, `..._TIMESTAMP` int64, `DLT_EXCEPTION_MESSAGE`, `DLT_EXCEPTION_STACKTRACE`). SmallRye Reactive Messaging Kafka `dead-letter-queue` strategy (`dead-letter-reason`, `dead-letter-cause`, `dead-letter-topic`, `dead-letter-partition`, `dead-letter-offset`, all written as UTF-8 strings). If a name or encoding differs, change it in `HeaderPreset` below and in the spec's preset table; the tests in Step 2 pin whatever is confirmed.

- [ ] **Step 2: Write failing tests**

`HeaderMappingTest.java`:
```java
package it.dls.domain.dlqconfig;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

class HeaderMappingTest {

    @Test
    void emptyMappingHasNoFields() {
        var m = HeaderMapping.empty();
        assertThat(m.originalTopic()).isNull();
        assertThat(m.binaryEncodings()).isEmpty();
    }

    @Test
    void binaryEncodingsListsOnlyNonStringFields() {
        var m = new HeaderMapping(
            new HeaderField("t", HeaderEncoding.STRING),
            new HeaderField("p", HeaderEncoding.INT32),
            new HeaderField("o", HeaderEncoding.INT64),
            null, null, null);
        assertThat(m.binaryEncodings())
            .isEqualTo(Map.of("p", HeaderEncoding.INT32, "o", HeaderEncoding.INT64));
    }

    @Test
    void headerFieldRejectsBlankName() {
        assertThatThrownBy(() -> new HeaderField(" ", HeaderEncoding.STRING))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void headerFieldNullEncodingDefaultsToString() {
        assertThat(new HeaderField("x", null).encoding()).isEqualTo(HeaderEncoding.STRING);
    }

    @Test
    void originalTopicMustBeString() {
        assertThatThrownBy(() -> new HeaderMapping(
            new HeaderField("t", HeaderEncoding.INT32), null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("originalTopic");
    }

    @Test
    void partitionCannotBeInt64() {
        assertThatThrownBy(() -> new HeaderMapping(
            null, new HeaderField("p", HeaderEncoding.INT64), null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("originalPartition");
    }

    @Test
    void offsetAndTimestampCannotBeInt32() {
        assertThatThrownBy(() -> new HeaderMapping(
            null, null, new HeaderField("o", HeaderEncoding.INT32), null, null, null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("originalOffset");
        assertThatThrownBy(() -> new HeaderMapping(
            null, null, null, new HeaderField("ts", HeaderEncoding.INT32), null, null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("originalTimestamp");
    }
}
```

`HeaderPresetTest.java`:
```java
package it.dls.domain.dlqconfig;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class HeaderPresetTest {

    @Test
    void legacyKeepsXOriginalTopic() {
        var m = HeaderPreset.LEGACY.mapping();
        assertThat(m.originalTopic().name()).isEqualTo("x-original-topic");
        assertThat(m.exceptionMessage().name()).isEqualTo("x-exception-message");
        assertThat(m.originalPartition()).isNull();
    }

    @Test
    void springPresetUsesDltHeadersWithBinaryEncodings() {
        var m = HeaderPreset.SPRING.mapping();
        assertThat(m.originalTopic().name()).isEqualTo("kafka_dlt-original-topic");
        assertThat(m.originalPartition()).isEqualTo(new HeaderField("kafka_dlt-original-partition", HeaderEncoding.INT32));
        assertThat(m.originalOffset()).isEqualTo(new HeaderField("kafka_dlt-original-offset", HeaderEncoding.INT64));
        assertThat(m.originalTimestamp()).isEqualTo(new HeaderField("kafka_dlt-original-timestamp", HeaderEncoding.INT64));
        assertThat(m.exceptionMessage().name()).isEqualTo("kafka_dlt-exception-message");
        assertThat(m.exceptionStacktrace().name()).isEqualTo("kafka_dlt-exception-stacktrace");
    }

    @Test
    void quarkusSmallryePresetUsesDeadLetterHeaders() {
        var m = HeaderPreset.QUARKUS_SMALLRYE.mapping();
        assertThat(m.originalTopic().name()).isEqualTo("dead-letter-topic");
        assertThat(m.originalPartition().name()).isEqualTo("dead-letter-partition");
        assertThat(m.originalOffset().name()).isEqualTo("dead-letter-offset");
        assertThat(m.originalTimestamp()).isNull();
        assertThat(m.exceptionMessage().name()).isEqualTo("dead-letter-reason");
        assertThat(m.exceptionStacktrace().name()).isEqualTo("dead-letter-cause");
        assertThat(m.binaryEncodings()).isEmpty();
    }

    @Test
    void customPresetMappingIsEmpty() {
        assertThat(HeaderPreset.CUSTOM.mapping()).isEqualTo(HeaderMapping.empty());
    }
}
```

`FailureInfoExtractorTest.java`:
```java
package it.dls.application.inspection;

import it.dls.domain.dlqconfig.HeaderPreset;
import it.dls.domain.message.FailureInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class FailureInfoExtractorTest {

    private final FailureInfoExtractor extractor = new FailureInfoExtractor();

    @Test
    void extractsAllFieldsForSpringPreset() {
        var headers = Map.of(
            "kafka_dlt-original-topic", "orders",
            "kafka_dlt-original-partition", "3",
            "kafka_dlt-original-offset", "42",
            "kafka_dlt-original-timestamp", "1700000000000",
            "kafka_dlt-exception-message", "boom",
            "kafka_dlt-exception-stacktrace", "java.lang.X\n at Y");
        var info = extractor.extract(headers, HeaderPreset.SPRING.mapping());
        assertThat(info).isEqualTo(new FailureInfo("orders", 3, 42L,
            Instant.ofEpochMilli(1700000000000L), "boom", "java.lang.X\n at Y"));
    }

    @Test
    void missingHeadersYieldNullFields() {
        var info = extractor.extract(Map.of("kafka_dlt-original-topic", "orders"),
            HeaderPreset.SPRING.mapping());
        assertThat(info.originalTopic()).isEqualTo("orders");
        assertThat(info.originalPartition()).isNull();
        assertThat(info.exceptionMessage()).isNull();
    }

    @Test
    void nonNumericValueYieldsNullNotException() {
        var info = extractor.extract(Map.of("dead-letter-partition", "abc",
            "dead-letter-offset", "9999999999999999999999"), HeaderPreset.QUARKUS_SMALLRYE.mapping());
        assertThat(info.originalPartition()).isNull();
        assertThat(info.originalOffset()).isNull();
    }

    @Test
    void timestampAcceptsIsoInstantFallback() {
        var mapping = new it.dls.domain.dlqconfig.HeaderMapping(null, null, null,
            new it.dls.domain.dlqconfig.HeaderField("ts", it.dls.domain.dlqconfig.HeaderEncoding.STRING),
            null, null);
        var info = extractor.extract(Map.of("ts", "2026-01-02T03:04:05Z"), mapping);
        assertThat(info.originalTimestamp()).isEqualTo(Instant.parse("2026-01-02T03:04:05Z"));
    }

    @Test
    void nullHeadersMapYieldsEmpty() {
        assertThat(extractor.extract(null, HeaderPreset.LEGACY.mapping())).isEqualTo(FailureInfo.empty());
    }

    @Test
    void emptyMappingYieldsEmpty() {
        assertThat(extractor.extract(Map.of("x-original-topic", "orders"),
            it.dls.domain.dlqconfig.HeaderMapping.empty())).isEqualTo(FailureInfo.empty());
    }
}
```

- [ ] **Step 3: Run tests, verify FAIL (compilation errors: classes missing)**

Run: `cd backend && ./gradlew test --tests 'it.dls.domain.dlqconfig.Header*' --tests 'it.dls.application.inspection.FailureInfoExtractorTest'`
Expected: FAIL (cannot find symbol).

- [ ] **Step 4: Implement**

`HeaderEncoding.java`:
```java
package it.dls.domain.dlqconfig;

public enum HeaderEncoding { STRING, INT32, INT64 }
```

`HeaderField.java`:
```java
package it.dls.domain.dlqconfig;

public record HeaderField(String name, HeaderEncoding encoding) {
    public HeaderField {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("header name must not be blank");
        if (encoding == null) encoding = HeaderEncoding.STRING;
    }
}
```

`HeaderMapping.java`:
```java
package it.dls.domain.dlqconfig;

import java.util.HashMap;
import java.util.Map;

public record HeaderMapping(
    HeaderField originalTopic,
    HeaderField originalPartition,
    HeaderField originalOffset,
    HeaderField originalTimestamp,
    HeaderField exceptionMessage,
    HeaderField exceptionStacktrace
) {
    public HeaderMapping {
        requireStringOnly("originalTopic", originalTopic);
        requireStringOnly("exceptionMessage", exceptionMessage);
        requireStringOnly("exceptionStacktrace", exceptionStacktrace);
        if (originalPartition != null && originalPartition.encoding() == HeaderEncoding.INT64)
            throw new IllegalArgumentException("originalPartition encoding must be STRING or INT32");
        reject32("originalOffset", originalOffset);
        reject32("originalTimestamp", originalTimestamp);
    }

    public static HeaderMapping empty() {
        return new HeaderMapping(null, null, null, null, null, null);
    }

    /** Header name → binary encoding, for headers that are not plain strings. */
    public Map<String, HeaderEncoding> binaryEncodings() {
        var result = new HashMap<String, HeaderEncoding>();
        for (var f : new HeaderField[]{originalPartition, originalOffset, originalTimestamp}) {
            if (f != null && f.encoding() != HeaderEncoding.STRING) result.put(f.name(), f.encoding());
        }
        return Map.copyOf(result);
    }

    private static void requireStringOnly(String field, HeaderField f) {
        if (f != null && f.encoding() != HeaderEncoding.STRING)
            throw new IllegalArgumentException(field + " encoding must be STRING");
    }

    private static void reject32(String field, HeaderField f) {
        if (f != null && f.encoding() == HeaderEncoding.INT32)
            throw new IllegalArgumentException(field + " encoding must be STRING or INT64");
    }
}
```

`HeaderPreset.java`:
```java
package it.dls.domain.dlqconfig;

import static it.dls.domain.dlqconfig.HeaderEncoding.*;

public enum HeaderPreset {
    LEGACY(new HeaderMapping(
        f("x-original-topic", STRING), null, null, null,
        f("x-exception-message", STRING), null)),
    SPRING(new HeaderMapping(
        f("kafka_dlt-original-topic", STRING),
        f("kafka_dlt-original-partition", INT32),
        f("kafka_dlt-original-offset", INT64),
        f("kafka_dlt-original-timestamp", INT64),
        f("kafka_dlt-exception-message", STRING),
        f("kafka_dlt-exception-stacktrace", STRING))),
    QUARKUS_SMALLRYE(new HeaderMapping(
        f("dead-letter-topic", STRING),
        f("dead-letter-partition", STRING),
        f("dead-letter-offset", STRING),
        null,
        f("dead-letter-reason", STRING),
        f("dead-letter-cause", STRING))),
    CUSTOM(HeaderMapping.empty());

    private final HeaderMapping mapping;

    HeaderPreset(HeaderMapping mapping) { this.mapping = mapping; }

    public HeaderMapping mapping() { return mapping; }

    private static HeaderField f(String name, HeaderEncoding enc) { return new HeaderField(name, enc); }
}
```

`domain/message/FailureInfo.java`:
```java
package it.dls.domain.message;

import java.time.Instant;

public record FailureInfo(
    String originalTopic,
    Integer originalPartition,
    Long originalOffset,
    Instant originalTimestamp,
    String exceptionMessage,
    String exceptionStacktrace
) {
    public static FailureInfo empty() {
        return new FailureInfo(null, null, null, null, null, null);
    }
}
```

`application/inspection/FailureInfoExtractor.java`:
```java
package it.dls.application.inspection;

import it.dls.domain.dlqconfig.HeaderField;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.message.FailureInfo;

import java.time.Instant;
import java.util.Map;

/** Derives a normalized FailureInfo from stored (string) headers. Never throws on bad values. */
public class FailureInfoExtractor {

    public FailureInfo extract(Map<String, String> headers, HeaderMapping mapping) {
        if (headers == null || mapping == null) return FailureInfo.empty();
        return new FailureInfo(
            text(headers, mapping.originalTopic()),
            toInt(text(headers, mapping.originalPartition())),
            toLong(text(headers, mapping.originalOffset())),
            toInstant(text(headers, mapping.originalTimestamp())),
            text(headers, mapping.exceptionMessage()),
            text(headers, mapping.exceptionStacktrace()));
    }

    private static String text(Map<String, String> headers, HeaderField f) {
        return f == null ? null : headers.get(f.name());
    }

    private static Integer toInt(String s) {
        if (s == null) return null;
        try { return Integer.valueOf(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Long toLong(String s) {
        if (s == null) return null;
        try { return Long.valueOf(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Instant toInstant(String s) {
        if (s == null) return null;
        var n = toLong(s);
        if (n != null) return Instant.ofEpochMilli(n);
        try { return Instant.parse(s.trim()); } catch (Exception e) { return null; }
    }
}
```

- [ ] **Step 5: Run tests, verify PASS**

Run: same command as Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/it/dls/domain backend/src/main/java/it/dls/application/inspection/FailureInfoExtractor.java backend/src/test/java/it/dls/domain/dlqconfig backend/src/test/java/it/dls/application/inspection/FailureInfoExtractorTest.java
git commit -m "feat(domain): header mapping, presets and failure info extractor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: HeaderDecoder (binary header decoding at ingestion)

**Files:**
- Create: `application/fetch/HeaderDecoder.java`
- Test: `application/fetch/HeaderDecoderTest.java`

**Interfaces:**
- Consumes: `HeaderMapping.binaryEncodings()`, `HeaderEncoding` (Task 1)
- Produces: `final class HeaderDecoder { Map<String,String> decode(Map<String,byte[]> raw, HeaderMapping mapping) }` — INT32 header with 4 bytes → decimal string; INT64 with 8 bytes → decimal string; wrong length → base64 string; all other headers → UTF-8 string; null `raw` → empty map.

- [ ] **Step 1: Write failing test**

```java
package it.dls.application.fetch;

import it.dls.application.inspection.FailureInfoExtractor;
import it.dls.domain.dlqconfig.HeaderPreset;
import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class HeaderDecoderTest {

    private final HeaderDecoder decoder = new HeaderDecoder();

    private static byte[] int32(int v) { return ByteBuffer.allocate(4).putInt(v).array(); }
    private static byte[] int64(long v) { return ByteBuffer.allocate(8).putLong(v).array(); }
    private static byte[] utf8(String s) { return s.getBytes(StandardCharsets.UTF_8); }

    @Test
    void decodesSpringBinaryHeadersToDecimalStrings() {
        var raw = new HashMap<String, byte[]>();
        raw.put("kafka_dlt-original-topic", utf8("orders"));
        raw.put("kafka_dlt-original-partition", int32(3));
        raw.put("kafka_dlt-original-offset", int64(42L));
        raw.put("kafka_dlt-original-timestamp", int64(1700000000000L));
        raw.put("kafka_dlt-exception-message", utf8("boom"));
        var out = decoder.decode(raw, HeaderPreset.SPRING.mapping());
        assertThat(out).containsEntry("kafka_dlt-original-topic", "orders")
            .containsEntry("kafka_dlt-original-partition", "3")
            .containsEntry("kafka_dlt-original-offset", "42")
            .containsEntry("kafka_dlt-original-timestamp", "1700000000000")
            .containsEntry("kafka_dlt-exception-message", "boom");
    }

    @Test
    void wrongLengthBinaryHeaderIsStoredAsBase64AndExtractsToNull() {
        var raw = Map.of("kafka_dlt-original-partition", new byte[]{1, 2, 3});
        var out = decoder.decode(raw, HeaderPreset.SPRING.mapping());
        assertThat(out.get("kafka_dlt-original-partition"))
            .isEqualTo(Base64.getEncoder().encodeToString(new byte[]{1, 2, 3}));
        assertThat(new FailureInfoExtractor().extract(out, HeaderPreset.SPRING.mapping()).originalPartition())
            .isNull();
    }

    @Test
    void unmappedHeadersAreDecodedAsUtf8EvenWhenNamedLikeBinary() {
        var raw = Map.of("x-correlation-id", utf8("abc-123"));
        var out = decoder.decode(raw, HeaderPreset.SPRING.mapping());
        assertThat(out).containsEntry("x-correlation-id", "abc-123");
    }

    @Test
    void stringEncodedHeadersStayStrings() {
        var raw = Map.of("dead-letter-partition", utf8("7"));
        assertThat(decoder.decode(raw, HeaderPreset.QUARKUS_SMALLRYE.mapping()))
            .containsEntry("dead-letter-partition", "7");
    }

    @Test
    void nullInputYieldsEmptyMap() {
        assertThat(decoder.decode(null, HeaderPreset.LEGACY.mapping())).isEmpty();
    }
}
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd backend && ./gradlew test --tests 'it.dls.application.fetch.HeaderDecoderTest'`
Expected: FAIL (HeaderDecoder missing).

- [ ] **Step 3: Implement**

```java
package it.dls.application.fetch;

import it.dls.domain.dlqconfig.HeaderEncoding;
import it.dls.domain.dlqconfig.HeaderMapping;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/** Converts raw Kafka header bytes to the string map persisted on DlqMessage. */
public class HeaderDecoder {

    public Map<String, String> decode(Map<String, byte[]> raw, HeaderMapping mapping) {
        var out = new HashMap<String, String>();
        if (raw == null) return out;
        var binary = mapping == null ? Map.<String, HeaderEncoding>of() : mapping.binaryEncodings();
        raw.forEach((name, bytes) -> {
            if (bytes == null) return;
            out.put(name, decodeValue(bytes, binary.get(name)));
        });
        return out;
    }

    private static String decodeValue(byte[] bytes, HeaderEncoding encoding) {
        if (encoding == HeaderEncoding.INT32 && bytes.length == Integer.BYTES)
            return Integer.toString(ByteBuffer.wrap(bytes).getInt());
        if (encoding == HeaderEncoding.INT64 && bytes.length == Long.BYTES)
            return Long.toString(ByteBuffer.wrap(bytes).getLong());
        if (encoding != null && encoding != HeaderEncoding.STRING)
            return Base64.getEncoder().encodeToString(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
```

- [ ] **Step 4: Run, verify PASS** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/it/dls/application/fetch/HeaderDecoder.java backend/src/test/java/it/dls/application/fetch/HeaderDecoderTest.java
git commit -m "feat(fetch): decode binary DLQ headers per mapping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: DlqConfig carries the mapping; persistence + migration V10

**Files:**
- Modify: `domain/dlqconfig/DlqConfig.java`
- Create: `backend/src/main/resources/db/migration/V10__header_mapping.sql`
- Modify: `infrastructure/persistence/DlqConfigEntity.java`, `DlqConfigRepositoryAdapter.java:18-35` (the `save` else-branch)
- Test: `domain/dlqconfig/DlqConfigTest.java` (add), `infrastructure/persistence/DlqConfigRepositoryAdapterIT.java` (add)

**Interfaces:**
- Consumes: `HeaderPreset`, `HeaderMapping` (Task 1)
- Produces on `DlqConfig`: `HeaderPreset getHeaderPreset()`, `HeaderMapping getHeaderMapping()` (default `LEGACY`), `void changeHeaderMapping(HeaderPreset preset, HeaderMapping custom)` (preset ≠ CUSTOM → uses `preset.mapping()`, `custom` ignored; CUSTOM → `custom` required non-null, else `IllegalArgumentException`), new `reconstitute(..., String defaultReplayTopic, HeaderPreset headerPreset, HeaderMapping headerMapping)` overload.

- [ ] **Step 1: Write failing domain tests** (append to `DlqConfigTest`)

```java
    @Test
    void newConfigDefaultsToLegacyHeaderMapping() {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.LEGACY);
        assertThat(c.getHeaderMapping()).isEqualTo(HeaderPreset.LEGACY.mapping());
    }

    @Test
    void changeHeaderMappingWithPresetIgnoresCustom() {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        c.changeHeaderMapping(HeaderPreset.SPRING, HeaderMapping.empty());
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.SPRING);
        assertThat(c.getHeaderMapping()).isEqualTo(HeaderPreset.SPRING.mapping());
    }

    @Test
    void changeHeaderMappingCustomUsesProvidedMapping() {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        var custom = new HeaderMapping(new HeaderField("my-topic", HeaderEncoding.STRING),
            null, null, null, null, null);
        c.changeHeaderMapping(HeaderPreset.CUSTOM, custom);
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.CUSTOM);
        assertThat(c.getHeaderMapping()).isEqualTo(custom);
    }

    @Test
    void changeHeaderMappingCustomWithoutMappingFails() {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        assertThatThrownBy(() -> c.changeHeaderMapping(HeaderPreset.CUSTOM, null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> c.changeHeaderMapping(null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }
```
(Ensure `DlqConfigTest` imports `java.util.UUID` and `static org.assertj.core.api.Assertions.*`; the package is already `it.dls.domain.dlqconfig`.)

- [ ] **Step 2: Run, verify FAIL**

Run: `cd backend && ./gradlew test --tests 'it.dls.domain.dlqconfig.DlqConfigTest'` → FAIL (methods missing).

- [ ] **Step 3: Implement domain changes in `DlqConfig.java`**

Add fields after `defaultReplayTopic`:
```java
    private HeaderPreset headerPreset = HeaderPreset.LEGACY;
    private HeaderMapping headerMapping = HeaderPreset.LEGACY.mapping();
```
Make the existing 10-arg `reconstitute` delegate to the new one, and add the new overload:
```java
    public static DlqConfig reconstitute(UUID id, UUID clusterId, String topicName, String displayName,
                                         FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                                         UUID schemaRegistryId, List<UserAssignment> assignments,
                                         List<PartitionOffset> partitionOffsets,
                                         String defaultReplayTopic) {
        return reconstitute(id, clusterId, topicName, displayName, fetchConfig, retentionPolicy,
            schemaRegistryId, assignments, partitionOffsets, defaultReplayTopic,
            HeaderPreset.LEGACY, HeaderPreset.LEGACY.mapping());
    }

    public static DlqConfig reconstitute(UUID id, UUID clusterId, String topicName, String displayName,
                                         FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                                         UUID schemaRegistryId, List<UserAssignment> assignments,
                                         List<PartitionOffset> partitionOffsets,
                                         String defaultReplayTopic,
                                         HeaderPreset headerPreset, HeaderMapping headerMapping) {
        var c = new DlqConfig();
        c.id = id;
        c.clusterId = clusterId;
        c.topicName = topicName;
        c.displayName = displayName;
        c.fetchConfig = fetchConfig;
        c.retentionPolicy = retentionPolicy;
        c.schemaRegistryId = schemaRegistryId;
        c.defaultReplayTopic = defaultReplayTopic;
        c.headerPreset = headerPreset != null ? headerPreset : HeaderPreset.LEGACY;
        c.headerMapping = headerMapping != null ? headerMapping : c.headerPreset.mapping();
        if (assignments != null) c.userAssignments.addAll(assignments);
        if (partitionOffsets != null) c.partitionOffsets.addAll(partitionOffsets);
        return c;
    }
```
(Replace the existing body of the 10-arg overload with the delegating version above.) Add method and getters:
```java
    public void changeHeaderMapping(HeaderPreset preset, HeaderMapping custom) {
        if (preset == null)
            throw new IllegalArgumentException("headerPreset must not be null");
        if (preset == HeaderPreset.CUSTOM) {
            if (custom == null)
                throw new IllegalArgumentException("headerMapping is required for CUSTOM preset");
            this.headerMapping = custom;
        } else {
            this.headerMapping = preset.mapping();
        }
        this.headerPreset = preset;
    }

    public HeaderPreset getHeaderPreset() { return headerPreset; }
    public HeaderMapping getHeaderMapping() { return headerMapping; }
```

- [ ] **Step 4: Run domain tests, verify PASS** — same command.

- [ ] **Step 5: Migration** `V10__header_mapping.sql`

```sql
ALTER TABLE dlq_configs
    ADD COLUMN IF NOT EXISTS header_preset VARCHAR(30) NOT NULL DEFAULT 'LEGACY';

ALTER TABLE dlq_configs
    ADD COLUMN IF NOT EXISTS header_mapping JSONB NOT NULL DEFAULT
    '{"originalTopic":{"name":"x-original-topic","encoding":"STRING"},"originalPartition":null,"originalOffset":null,"originalTimestamp":null,"exceptionMessage":{"name":"x-exception-message","encoding":"STRING"},"exceptionStacktrace":null}'::jsonb;
```

- [ ] **Step 6: Entity + adapter**

In `DlqConfigEntity` add imports `com.fasterxml.jackson.databind.JsonNode`, `com.fasterxml.jackson.databind.ObjectMapper`, `org.hibernate.annotations.JdbcTypeCode`, `org.hibernate.type.SqlTypes` and fields (follow the `JsonNode` + `@JdbcTypeCode(SqlTypes.JSON)` pattern already used by `DlqMessageEntity.decodedPayload`):
```java
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Enumerated(EnumType.STRING)
    @Column(name = "header_preset")
    public HeaderPreset headerPreset = HeaderPreset.LEGACY;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "header_mapping", columnDefinition = "jsonb")
    public JsonNode headerMapping;

    public static JsonNode mappingToJson(HeaderMapping m) { return MAPPER.valueToTree(m); }

    private static HeaderMapping mappingFromJson(JsonNode n) {
        try { return MAPPER.treeToValue(n, HeaderMapping.class); }
        catch (Exception e) { throw new IllegalStateException("Invalid header_mapping JSON", e); }
    }
```
In `fromDomain` add after `e.defaultReplayTopic = ...`:
```java
        e.headerPreset = c.getHeaderPreset();
        e.headerMapping = mappingToJson(c.getHeaderMapping());
```
In `toDomain` replace the final `return` with:
```java
        return DlqConfig.reconstitute(id, clusterId, topicName, displayName,
            fetch, retention, schemaRegistryId, userAssignments, offsets, defaultReplayTopic,
            headerPreset, headerMapping == null ? null : mappingFromJson(headerMapping));
```
In `DlqConfigRepositoryAdapter.save` else-branch add after `existing.defaultReplayTopic = ...`:
```java
            existing.headerPreset = config.getHeaderPreset();
            existing.headerMapping = DlqConfigEntity.mappingToJson(config.getHeaderMapping());
```

- [ ] **Step 7: Write failing IT** (append to `DlqConfigRepositoryAdapterIT`)

```java
    @Test
    @TestTransaction
    void headerMappingRoundTripsForEachPreset() {
        var cluster = savedCluster();
        for (var preset : new HeaderPreset[]{HeaderPreset.LEGACY, HeaderPreset.SPRING, HeaderPreset.QUARKUS_SMALLRYE}) {
            var config = DlqConfig.create(cluster.getId(), "t-" + preset, "T " + preset,
                FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
            config.changeHeaderMapping(preset, null);
            repo.save(config);
            var found = repo.findById(config.getId()).orElseThrow();
            assertThat(found.getHeaderPreset()).isEqualTo(preset);
            assertThat(found.getHeaderMapping()).isEqualTo(preset.mapping());
        }
    }

    @Test
    @TestTransaction
    void customHeaderMappingRoundTripsAndUpdates() {
        var cluster = savedCluster();
        var config = DlqConfig.create(cluster.getId(), "custom-dlq", "Custom",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        repo.save(config);
        var custom = new HeaderMapping(new HeaderField("my-topic", HeaderEncoding.STRING),
            new HeaderField("my-part", HeaderEncoding.INT32), null, null, null, null);
        config.changeHeaderMapping(HeaderPreset.CUSTOM, custom);
        repo.save(config);
        var found = repo.findById(config.getId()).orElseThrow();
        assertThat(found.getHeaderPreset()).isEqualTo(HeaderPreset.CUSTOM);
        assertThat(found.getHeaderMapping()).isEqualTo(custom);
    }

    @Test
    @TestTransaction
    void rowsInsertedWithoutMappingColumnsGetLegacyDefaults() {
        var cluster = savedCluster();
        var id = UUID.randomUUID();
        em.createNativeQuery("""
            INSERT INTO dlq_configs (id, cluster_id, topic_name, display_name, download_mode,
                batch_size, retention_type, retention_value, created_at, updated_at)
            VALUES (:id, :cid, 'old-dlq', 'Old', 'ON_DEMAND', 10, 'MAX_COUNT', 10, now(), now())
            """).setParameter("id", id).setParameter("cid", cluster.getId()).executeUpdate();
        em.clear();
        var found = repo.findById(id).orElseThrow();
        assertThat(found.getHeaderPreset()).isEqualTo(HeaderPreset.LEGACY);
        assertThat(found.getHeaderMapping().originalTopic().name()).isEqualTo("x-original-topic");
    }
```
Add `@Inject jakarta.persistence.EntityManager em;` to the class. If the raw INSERT fails because other NOT NULL columns exist, add the missing columns with simple literals (check `V3__cluster_dlqconfig.sql`).

- [ ] **Step 8: Run IT, verify PASS**

Run: `cd backend && ./gradlew test --tests 'it.dls.infrastructure.persistence.DlqConfigRepositoryAdapterIT'`
Expected: PASS (Flyway applies V10 against the test DB). If JSON (de)serialization of the record fails, fix the entity conversion, not the domain.

- [ ] **Step 9: Run full backend tests for regressions**

Run: `cd backend && ./gradlew test` → all PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src
git commit -m "feat(dlqconfig): persist header preset and mapping (V10)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ingestion uses the mapping; Replay resolves topic from mapping; bulk replay accepts a topic override

**Files:**
- Modify: `domain/shared/RawKafkaMessage.java`, `infrastructure/kafka/KafkaConsumerAdapter.java:109-114`, `application/fetch/FetchMessagesUseCase.java` (`ingest`, ~line 216), `application/replay/ReplayTopicResolver.java`, `application/replay/ReplayTopicNotResolvableException.java`, `application/replay/BulkReplayUseCase.java`, `infrastructure/api/message/BulkReplayRequest.java`, `infrastructure/api/message/DlqConfigMessagesResource.java:61-75`
- Test: `application/fetch/FetchMessagesUseCaseTest.java` (add), `application/replay/ReplayTopicResolverTest.java` (add), `application/replay/ReplayMessageUseCaseTest.java` (add), `application/replay/BulkReplayUseCaseTest.java` (new)

**Interfaces:**
- Consumes: `HeaderDecoder.decode` (Task 2), `DlqConfig.getHeaderMapping()` (Task 3)
- Produces: `RawKafkaMessage(int partition, long offset, Instant timestamp, byte[] key, byte[] value, Map<String,byte[]> headers)`; `ReplayTopicNotResolvableException(UUID messageId)` message no longer names a fixed header; `BulkReplayUseCase.bulkReplay(UUID dlqConfigId, List<UUID> messageIds, UUID replayedBy, String targetTopicOverride)` (the 3-arg overload stays and delegates with `null`); `BulkReplayRequest(List<UUID> messageIds, String targetTopicOverride)` (`targetTopicOverride` optional, blank treated as absent).

- [ ] **Step 1: Write failing tests**

Append to `ReplayTopicResolverTest`:
```java
    @Test
    void fallsBackToSpringOriginalTopicHeaderWhenPresetIsSpring() {
        var msg = messageWithHeader("kafka_dlt-original-topic", "orders");
        var config = configWithNoOverride();
        config.changeHeaderMapping(it.dls.domain.dlqconfig.HeaderPreset.SPRING, null);
        assertThat(resolver.resolve(msg, config, null)).isEqualTo("orders");
    }

    @Test
    void legacyHeaderIgnoredWhenPresetIsSpring() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithNoOverride();
        config.changeHeaderMapping(it.dls.domain.dlqconfig.HeaderPreset.SPRING, null);
        assertThatThrownBy(() -> resolver.resolve(msg, config, null))
            .isInstanceOf(ReplayTopicNotResolvableException.class);
    }

    @Test
    void throwsWhenMappingHasNoOriginalTopicField() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithNoOverride();
        config.changeHeaderMapping(it.dls.domain.dlqconfig.HeaderPreset.CUSTOM,
            it.dls.domain.dlqconfig.HeaderMapping.empty());
        assertThatThrownBy(() -> resolver.resolve(msg, config, null))
            .isInstanceOf(ReplayTopicNotResolvableException.class);
    }
```

Append to `FetchMessagesUseCaseTest` (uses existing helpers `buildCluster`, `buildDlqConfig`; import `java.nio.ByteBuffer`):
```java
    // Header mapping: Spring binary headers are decoded using the config's mapping
    @Test
    void springBinaryHeadersDecodedUsingConfigMapping() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        config.changeHeaderMapping(HeaderPreset.SPRING, null);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any())).thenReturn(Map.of(0, 0L));
        var headers = new HashMap<String, byte[]>();
        headers.put("kafka_dlt-original-topic", "orders".getBytes());
        headers.put("kafka_dlt-original-partition", ByteBuffer.allocate(4).putInt(3).array());
        headers.put("kafka_dlt-original-offset", ByteBuffer.allocate(8).putLong(42L).array());
        var raw = new RawKafkaMessage(0, 5L, Instant.now(), null, "{}".getBytes(), headers);
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(List.of(raw));

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(messageRepo).save(argThat((DlqMessage m) ->
            "orders".equals(m.getHeaders().get("kafka_dlt-original-topic"))
            && "3".equals(m.getHeaders().get("kafka_dlt-original-partition"))
            && "42".equals(m.getHeaders().get("kafka_dlt-original-offset"))));
    }
```

Append to `FetchMessagesUseCaseTest` — a message with no headers at all is ingested under a non-legacy preset:
```java
    @Test
    void messageWithoutAnyHeadersIsIngestedUnderSpringPreset() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        config.changeHeaderMapping(HeaderPreset.SPRING, null);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any())).thenReturn(Map.of(0, 0L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt()))
            .thenReturn(List.of(new RawKafkaMessage(0, 1L, Instant.now(), null, "{}".getBytes(), Map.of())));

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(messageRepo).save(argThat((DlqMessage m) -> m.getHeaders().isEmpty()));
    }
```

Append to `ReplayMessageUseCaseTest` — single replay succeeds with a wizard override when no mapped header exists (reuse the fixtures/mocks already in that class; mirror `successfulReplay_transitionsToReplayed` but with `Map.of()` headers and a non-null override):
```java
    @Test
    void replayWithoutOriginalTopicHeaderSucceedsWhenWizardSuppliesTopic() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW, Map.of(), null);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config(CONFIG_ID, CLUSTER_ID)));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(plaintextCluster(CLUSTER_ID)));

        var result = useCase.replay(MSG_ID, "orders-manual", null, USER_ID);

        assertThat(result.success()).isTrue();
        verify(producer).publish(any(), any(), eq("orders-manual"), any(), any(), any());
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAYED);
    }
```
(If the neighbouring success test stubs additional collaborators — e.g. `schemaRegistry` — copy those stubs; adjust the `replay(...)` call to the real signature used there.)

Create `application/replay/BulkReplayUseCaseTest.java`:
```java
package it.dls.application.replay;

import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.ReplayAuditRecordRepository;
import it.dls.domain.shared.EncryptionPort;
import it.dls.domain.shared.KafkaProducerPort;
import it.dls.domain.shared.NotificationPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class BulkReplayUseCaseTest {

    KafkaProducerPort producer = mock(KafkaProducerPort.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    KafkaClusterRepository clusterRepo = mock(KafkaClusterRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    ReplayAuditRecordRepository auditRepo = mock(ReplayAuditRecordRepository.class);
    EncryptionPort encryption = mock(EncryptionPort.class);
    BulkReplayUseCase useCase;

    static final UUID CONFIG_ID = UUID.randomUUID();
    static final UUID CLUSTER_ID = UUID.randomUUID();
    static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new BulkReplayUseCase();
        inject("producer", producer);
        inject("messageRepo", messageRepo);
        inject("configRepo", configRepo);
        inject("clusterRepo", clusterRepo);
        inject("notifier", notifier);
        inject("auditRepo", auditRepo);
        inject("encryption", encryption);
        when(encryption.decrypt(anyString())).thenAnswer(i -> i.getArgument(0));
        var config = DlqConfig.reconstitute(CONFIG_ID, CLUSTER_ID, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxCount(1000), null, null, null);
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(
            KafkaCluster.reconstitute(CLUSTER_ID, "c", "localhost:9092", KafkaSecurityConfig.plaintext(), null)));
    }

    private DlqMessage msg(Map<String, String> headers) {
        var m = DlqMessage.reconstitute(UUID.randomUUID(), CONFIG_ID, 0, 0L, Instant.now(),
            null, new byte[]{1}, null, null, headers, MessageStatus.NEW, false, Instant.now(), null, null);
        when(messageRepo.findById(m.getId())).thenReturn(Optional.of(m));
        return m;
    }

    @Test
    void messagesWithoutTopicHeaderCountAsFailedButDoNotAbortTheBatch() {
        var withHeader = msg(Map.of("x-original-topic", "orders"));
        var without = msg(Map.of());
        var result = useCase.bulkReplay(CONFIG_ID, List.of(without.getId(), withHeader.getId()), USER_ID);
        assertThat(result.succeeded()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(without.getStatus()).isEqualTo(MessageStatus.NEW);
    }

    @Test
    void targetTopicOverrideReplaysMessagesLackingTheHeader() {
        var a = msg(Map.of());
        var b = msg(Map.of("unrelated", "x"));
        var result = useCase.bulkReplay(CONFIG_ID, List.of(a.getId(), b.getId()), USER_ID, "orders-manual");
        assertThat(result.succeeded()).isEqualTo(2);
        assertThat(result.failed()).isZero();
        verify(producer, times(2)).publish(any(), any(), eq("orders-manual"), any(), any(), any());
    }

    @Test
    void blankOverrideIsTreatedAsAbsent() {
        var a = msg(Map.of());
        var result = useCase.bulkReplay(CONFIG_ID, List.of(a.getId()), USER_ID, "  ");
        assertThat(result.failed()).isEqualTo(1);
        verifyNoInteractions(producer);
    }

    private void inject(String field, Object value) {
        try {
            var f = BulkReplayUseCase.class.getDeclaredField(field);
            f.setAccessible(true);
            f.set(useCase, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd backend && ./gradlew test --tests 'it.dls.application.replay.*' --tests 'it.dls.application.fetch.FetchMessagesUseCaseTest'` → FAIL (compile/behaviour).

- [ ] **Step 3: Implement**

`RawKafkaMessage.java`: change last component to `Map<String, byte[]> headers`.

`KafkaConsumerAdapter.java` (replace the header loop):
```java
                    var headers = new HashMap<String, byte[]>();
                    for (var h : record.headers()) {
                        if (h.value() != null) {
                            headers.put(h.key(), h.value());
                        }
                    }
```

`FetchMessagesUseCase`: add field `private final HeaderDecoder headerDecoder = new HeaderDecoder();` and in `ingest` replace `raw.headers()` with `headerDecoder.decode(raw.headers(), config.getHeaderMapping())` (import `it.dls.application.fetch` is same package, no import needed).

`ReplayTopicResolver.java`:
```java
public class ReplayTopicResolver {

    public String resolve(DlqMessage message, DlqConfig config, String wizardOverride) {
        if (wizardOverride != null && !wizardOverride.isBlank()) return wizardOverride;
        if (config.getDefaultReplayTopic() != null) return config.getDefaultReplayTopic();
        var field = config.getHeaderMapping().originalTopic();
        if (field != null) {
            var header = message.getHeaders().get(field.name());
            if (header != null) return header;
        }
        throw new ReplayTopicNotResolvableException(message.getId());
    }
}
```
`ReplayTopicNotResolvableException`: change message to `"...: no wizard override, no config default, and no original-topic header found via the DLQ's header mapping"`.

`BulkReplayUseCase`: keep the 3-arg `bulkReplay` as a delegating overload and add the override:
```java
    @Transactional
    public BulkReplayResult bulkReplay(UUID dlqConfigId, List<UUID> messageIds, UUID replayedBy) {
        return bulkReplay(dlqConfigId, messageIds, replayedBy, null);
    }

    @Transactional
    public BulkReplayResult bulkReplay(UUID dlqConfigId, List<UUID> messageIds, UUID replayedBy,
                                       String targetTopicOverride) {
        // body unchanged, except: pass targetTopicOverride to replayOne(...)
    }
```
(Move the existing body into the 4-arg method; do not annotate the delegating overload twice if CDI complains — one `@Transactional` on the 4-arg method is enough.) Change `replayOne(...)` to take `String targetTopicOverride` and call `topicResolver.resolve(msg, config, targetTopicOverride)` instead of `resolve(msg, config, null)`. `ReplayTopicResolver` already treats blank overrides as absent.

`BulkReplayRequest.java`:
```java
public record BulkReplayRequest(List<UUID> messageIds, String targetTopicOverride) {}
```
`bulkDiscard` / `bulkMarkUnderReview` in `DlqConfigMessagesResource` also take `BulkReplayRequest`; they ignore the new field (Jackson tolerates its absence → `null`). Fix any other constructor call sites (`grep -rn "BulkReplayRequest(" backend/src`). In `DlqConfigMessagesResource.bulkReplay` change the call to `bulkReplay.bulkReplay(configId, req.messageIds(), currentUserId(), req.targetTopicOverride())`.

- [ ] **Step 4: Run, verify PASS**; then full suite `cd backend && ./gradlew test` (existing `Map.of()` raw headers still compile; existing replay tests rely on LEGACY default).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(fetch,replay): ingest decodes headers via mapping; replay resolves topic via mapping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: DlqConfig API — preset/mapping in create, update, response; presets endpoint

**Files:**
- Modify: `application/cluster/CreateDlqConfigCommand.java`, `UpdateDlqConfigCommand.java`, `ManageDlqConfigUseCase.java` (create ~line 39-41, update ~line 74), `infrastructure/api/cluster/CreateDlqConfigRequest.java`, `UpdateDlqConfigRequest.java`, `DlqConfigResponse.java`, `ClusterResource.java:97-101,121-124`
- Create: `infrastructure/api/cluster/HeaderPresetResource.java`
- Test: `application/cluster/ManageDlqConfigUseCaseTest.java` (add), `infrastructure/api/DlqConfigHeaderMappingIT.java` (new)

**Interfaces:**
- Consumes: `DlqConfig.changeHeaderMapping`, `HeaderPreset`, `HeaderMapping` (Task 3)
- Produces: JSON fields `headerPreset` (`"LEGACY"|"SPRING"|"QUARKUS_SMALLRYE"|"CUSTOM"`) and `headerMapping` (`{originalTopic:{name,encoding}|null, originalPartition, originalOffset, originalTimestamp, exceptionMessage, exceptionStacktrace}`) on create/update request (both optional) and on `DlqConfigResponse`; `GET /api/header-presets` → `[{ "preset": "SPRING", "mapping": {...} }, ...]` for LEGACY, SPRING, QUARKUS_SMALLRYE (CUSTOM omitted).

Records keep their old constructors via secondary constructors so existing call sites/tests compile:

- [ ] **Step 1: Write failing use-case tests** (append to `ManageDlqConfigUseCaseTest`; reuse its existing fixtures for `useCase`, `clusterRepo`/`dlqConfigRepo` mocks — mirror the style of the existing `createDlqConfig` test at ~line 148)

```java
    @Test
    void createWithSpringPresetStoresSpringMapping() {
        // arrange cluster exists exactly like the neighbouring create test
        var cmd = new CreateDlqConfigCommand("orders-dlq", "Orders DLQ", DownloadMode.ON_DEMAND,
            null, 100, RetentionPolicy.RetentionType.MAX_COUNT, 100, null,
            HeaderPreset.SPRING, null);
        var config = useCase.createDlqConfig(clusterId, cmd);
        assertThat(config.getHeaderPreset()).isEqualTo(HeaderPreset.SPRING);
        assertThat(config.getHeaderMapping()).isEqualTo(HeaderPreset.SPRING.mapping());
    }

    @Test
    void createWithoutPresetDefaultsToLegacy() {
        var cmd = new CreateDlqConfigCommand("orders-dlq", "Orders DLQ", DownloadMode.ON_DEMAND,
            null, 100, RetentionPolicy.RetentionType.MAX_COUNT, 100, null);
        var config = useCase.createDlqConfig(clusterId, cmd);
        assertThat(config.getHeaderPreset()).isEqualTo(HeaderPreset.LEGACY);
    }

    @Test
    void updateWithNullPresetKeepsExistingMapping() {
        // existing config already SPRING (built via DlqConfig.create + changeHeaderMapping, returned by dlqConfigRepo.findById)
        var updated = useCase.updateDlqConfig(existing.getId(), new UpdateDlqConfigCommand(
            "New name", DownloadMode.ON_DEMAND, null, 100,
            RetentionPolicy.RetentionType.MAX_COUNT, 100, null, null));
        assertThat(updated.getHeaderPreset()).isEqualTo(HeaderPreset.SPRING);
    }

    @Test
    void updateWithCustomPresetAppliesMapping() {
        var custom = new HeaderMapping(new HeaderField("my-topic", HeaderEncoding.STRING),
            null, null, null, null, null);
        var updated = useCase.updateDlqConfig(existing.getId(), new UpdateDlqConfigCommand(
            "New name", DownloadMode.ON_DEMAND, null, 100,
            RetentionPolicy.RetentionType.MAX_COUNT, 100, null, null,
            HeaderPreset.CUSTOM, custom));
        assertThat(updated.getHeaderMapping()).isEqualTo(custom);
    }
```
Adapt variable names (`clusterId`, `existing`) to the fixtures already in that test class; define a local `existing` in the tests if none exists (`DlqConfig.create(...)` + `changeHeaderMapping(HeaderPreset.SPRING, null)` + `when(dlqConfigRepo.findById(existing.getId())).thenReturn(Optional.of(existing))`).

- [ ] **Step 2: Run, verify FAIL**

Run: `cd backend && ./gradlew test --tests 'it.dls.application.cluster.ManageDlqConfigUseCaseTest'` → FAIL (compile).

- [ ] **Step 3: Implement commands and use case**

`CreateDlqConfigCommand.java`:
```java
package it.dls.application.cluster;

import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.dlqconfig.HeaderPreset;
import it.dls.domain.dlqconfig.RetentionPolicy;

import java.util.UUID;

public record CreateDlqConfigCommand(
    String topicName,
    String displayName,
    DownloadMode downloadMode,
    String cronExpression,
    int batchSize,
    RetentionPolicy.RetentionType retentionType,
    int retentionValue,
    UUID schemaRegistryId,
    HeaderPreset headerPreset,       // nullable → LEGACY
    HeaderMapping headerMapping      // only used when headerPreset == CUSTOM
) {
    public CreateDlqConfigCommand(String topicName, String displayName, DownloadMode downloadMode,
                                  String cronExpression, int batchSize,
                                  RetentionPolicy.RetentionType retentionType, int retentionValue,
                                  UUID schemaRegistryId) {
        this(topicName, displayName, downloadMode, cronExpression, batchSize,
            retentionType, retentionValue, schemaRegistryId, null, null);
    }
}
```
`UpdateDlqConfigCommand.java` — same pattern: append `HeaderPreset headerPreset, HeaderMapping headerMapping` (nullable preset → keep existing) and add the 8-arg secondary constructor.

`ManageDlqConfigUseCase.createDlqConfig`: after `DlqConfig.create(...)` and before `dlqConfigRepo.save(config);` add
```java
        if (cmd.headerPreset() != null) config.changeHeaderMapping(cmd.headerPreset(), cmd.headerMapping());
```
`updateDlqConfig`: after `config.update(...)` add the same line with `cmd`.

- [ ] **Step 4: Run use-case tests, verify PASS.**

- [ ] **Step 5: Request/response DTOs and resources**

`CreateDlqConfigRequest` / `UpdateDlqConfigRequest`: append components `HeaderPreset headerPreset, HeaderMapping headerMapping` (domain types are plain records/enums, Jackson binds them directly; add the imports).

`DlqConfigResponse`: add components `HeaderPreset headerPreset, HeaderMapping headerMapping` after `defaultReplayTopic`, and in `from` pass `c.getHeaderPreset(), c.getHeaderMapping()` in the same position.

`ClusterResource.createDlqConfig`: build the command with `req.schemaRegistryId(), req.headerPreset(), req.headerMapping()`. `updateDlqConfig`: append `req.headerPreset(), req.headerMapping()`. A malformed custom mapping (domain `IllegalArgumentException` from `HeaderMapping`/`changeHeaderMapping`) is thrown while Jackson binds (→ Quarkus returns 400 for `ValueInstantiationException`? it may surface as 500) — so add to `ClusterResource` an exception mapper-safe path: in both methods wrap as already done (`catch (IllegalArgumentException e)` → `badRequest` on create; **on update change the catch to return `badRequest` when the message does not start with "DlqConfig not found"**):
```java
        } catch (IllegalArgumentException e) {
            return e.getMessage() != null && e.getMessage().startsWith("DlqConfig not found")
                ? ProblemDetail.notFound(e.getMessage()).toResponse()
                : ProblemDetail.badRequest(e.getMessage()).toResponse();
        }
```
For JSON-binding failures add `infrastructure/api/InvalidHeaderMappingMapper.java`:
```java
package it.dls.infrastructure.api;

import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class InvalidHeaderMappingMapper implements ExceptionMapper<JsonMappingException> {
    @Override
    public Response toResponse(JsonMappingException e) {
        var cause = e.getCause();
        var msg = cause instanceof IllegalArgumentException ? cause.getMessage() : "Invalid request body";
        return ProblemDetail.badRequest(msg).toResponse();
    }
}
```
(Check `ProblemDetail.badRequest(String)` exists — it's used in `ClusterResource` — and that no existing mapper already handles `JsonMappingException`; if one exists, extend it instead.)

`HeaderPresetResource.java`:
```java
package it.dls.infrastructure.api.cluster;

import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.dlqconfig.HeaderPreset;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.Arrays;
import java.util.List;

@Path("/api/header-presets")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class HeaderPresetResource {

    public record PresetResponse(HeaderPreset preset, HeaderMapping mapping) {}

    @GET
    public List<PresetResponse> list() {
        return Arrays.stream(HeaderPreset.values())
            .filter(p -> p != HeaderPreset.CUSTOM)
            .map(p -> new PresetResponse(p, p.mapping()))
            .toList();
    }
}
```

- [ ] **Step 6: Write failing REST IT** `infrastructure/api/DlqConfigHeaderMappingIT.java` modelled on `ClusterResourceIT` (same `@QuarkusTest`, `obtainAdminToken`, cleanup in `@BeforeEach` of `KafkaClusterEntity`/`UserEntity` with a distinct admin email `"header-it@dls.io"`). Create a cluster via `POST /api/clusters` using the same JSON body as the existing `ClusterResourceIT` create-cluster test (copy it), then:

```java
    @Test
    void createWithSpringPresetReturnsSpringMapping() {
        var token = obtainAdminToken();
        var clusterId = createCluster(token);
        given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
            .body("""
                {"topicName":"orders.dlq","displayName":"Orders","downloadMode":"ON_DEMAND",
                 "batchSize":100,"retentionType":"MAX_COUNT","retentionValue":100,
                 "headerPreset":"SPRING"}""")
            .post("/api/clusters/" + clusterId + "/dlq-configs")
            .then().statusCode(201)
            .body("headerPreset", equalTo("SPRING"))
            .body("headerMapping.originalTopic.name", equalTo("kafka_dlt-original-topic"))
            .body("headerMapping.originalPartition.encoding", equalTo("INT32"));
    }

    private static final String BASE_BODY = """
        {"topicName":"orders.dlq","displayName":"Orders","downloadMode":"ON_DEMAND",
         "batchSize":100,"retentionType":"MAX_COUNT","retentionValue":100%s}""";

    private io.restassured.response.ValidatableResponse create(String token, String clusterId, String extra) {
        return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
            .body(BASE_BODY.formatted(extra))
            .post("/api/clusters/" + clusterId + "/dlq-configs")
            .then();
    }

    @Test
    void createWithoutPresetReturnsLegacy() {
        var token = obtainAdminToken();
        create(token, createCluster(token), "")
            .statusCode(201)
            .body("headerPreset", equalTo("LEGACY"))
            .body("headerMapping.originalTopic.name", equalTo("x-original-topic"));
    }

    @Test
    void customMappingWithBlankNameIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(token),
            ",\"headerPreset\":\"CUSTOM\",\"headerMapping\":{\"originalTopic\":{\"name\":\" \",\"encoding\":\"STRING\"}}")
            .statusCode(400);
    }

    @Test
    void customMappingWithDisallowedEncodingIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(token),
            ",\"headerPreset\":\"CUSTOM\",\"headerMapping\":{\"originalTopic\":{\"name\":\"t\",\"encoding\":\"INT32\"}}")
            .statusCode(400);
    }

    @Test
    void customWithoutMappingIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(token), ",\"headerPreset\":\"CUSTOM\"")
            .statusCode(400);
    }

    @Test
    void updateSwitchesPresetAndPersists() {
        var token = obtainAdminToken();
        var clusterId = createCluster(token);
        String configId = create(token, clusterId, "").statusCode(201).extract().path("id");
        given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
            .body("""
                {"displayName":"Orders","downloadMode":"ON_DEMAND","batchSize":100,
                 "retentionType":"MAX_COUNT","retentionValue":100,
                 "headerPreset":"QUARKUS_SMALLRYE"}""")
            .put("/api/clusters/" + clusterId + "/dlq-configs/" + configId)
            .then().statusCode(200);
        given().header("Authorization", "Bearer " + token)
            .get("/api/dlq-configs/" + configId)
            .then().statusCode(200)
            .body("headerPreset", equalTo("QUARKUS_SMALLRYE"))
            .body("headerMapping.originalTopic.name", equalTo("dead-letter-topic"));
    }

    @Test
    void presetsEndpointListsThreePresets() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .get("/api/header-presets")
            .then().statusCode(200)
            .body("preset", contains("LEGACY", "SPRING", "QUARKUS_SMALLRYE"))
            .body("find { it.preset == 'SPRING' }.mapping.originalOffset.encoding", equalTo("INT64"));
    }
```
Write the comment-bodied tests out in full (no comments left as bodies), with a private `createCluster(token)` helper that copies the cluster-creation request used in `ClusterResourceIT`.

- [ ] **Step 7: Run IT, verify PASS**

Run: `cd backend && ./gradlew test --tests 'it.dls.infrastructure.api.DlqConfigHeaderMappingIT'`; then the full suite `./gradlew test`.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(api): header preset/mapping on DLQ config + presets endpoint

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Messages API exposes `failureInfo`

**Files:**
- Create: `application/inspection/FailureInfoAssembler.java`
- Modify: `infrastructure/api/message/MessageResponse.java`, `MessagePageResponse.java`, `MessageResource.java:28,53`, `DlqConfigMessagesResource.java:50`, `AllMessagesResource.java:32`
- Test: `application/inspection/FailureInfoAssemblerTest.java`, `infrastructure/api/MessageFailureInfoIT.java`

**Interfaces:**
- Consumes: `FailureInfoExtractor` (Task 1), `DlqConfigRepository.findById`
- Produces: `@ApplicationScoped class FailureInfoAssembler { Map<UUID, FailureInfo> assembleAll(Collection<DlqMessage> messages) }` keyed by **message id**; `MessageResponse.from(DlqMessage m, FailureInfo info)` and `MessagePageResponse.from(MessagePage p, Map<UUID,FailureInfo> infos)`. JSON: `failureInfo: {originalTopic, originalPartition, originalOffset, originalTimestamp, exceptionMessage, exceptionStacktrace}` (never absent; fields null when unknown).

- [ ] **Step 1: Failing unit test**

```java
package it.dls.application.inspection;

import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.FailureInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FailureInfoAssemblerTest {

    DlqConfigRepository repo = mock(DlqConfigRepository.class);
    FailureInfoAssembler assembler = new FailureInfoAssembler(repo);

    private DlqConfig config(HeaderPreset preset) {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        c.changeHeaderMapping(preset, null);
        return c;
    }

    private DlqMessage message(UUID configId, Map<String, String> headers) {
        return DlqMessage.ingest(configId, 0, 0L, Instant.now(), null, new byte[]{1}, null, null, headers, false);
    }

    @Test
    void usesEachMessagesConfigMapping() {
        var spring = config(HeaderPreset.SPRING);
        var legacy = config(HeaderPreset.LEGACY);
        when(repo.findById(spring.getId())).thenReturn(Optional.of(spring));
        when(repo.findById(legacy.getId())).thenReturn(Optional.of(legacy));
        var m1 = message(spring.getId(), Map.of("kafka_dlt-original-topic", "a"));
        var m2 = message(legacy.getId(), Map.of("x-original-topic", "b"));
        var result = assembler.assembleAll(List.of(m1, m2));
        assertThat(result.get(m1.getId()).originalTopic()).isEqualTo("a");
        assertThat(result.get(m2.getId()).originalTopic()).isEqualTo("b");
    }

    @Test
    void loadsEachConfigOnce() {
        var c = config(HeaderPreset.LEGACY);
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        assembler.assembleAll(List.of(message(c.getId(), Map.of()), message(c.getId(), Map.of())));
        verify(repo, times(1)).findById(c.getId());
    }

    @Test
    void missingConfigYieldsEmptyInfo() {
        var missing = UUID.randomUUID();
        when(repo.findById(missing)).thenReturn(Optional.empty());
        var m = message(missing, Map.of("x-original-topic", "a"));
        assertThat(assembler.assembleAll(List.of(m)).get(m.getId())).isEqualTo(FailureInfo.empty());
    }
}
```

- [ ] **Step 2: Run, verify FAIL**: `cd backend && ./gradlew test --tests 'it.dls.application.inspection.FailureInfoAssemblerTest'`

- [ ] **Step 3: Implement assembler**

```java
package it.dls.application.inspection;

import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.FailureInfo;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class FailureInfoAssembler {

    private final DlqConfigRepository configRepo;
    private final FailureInfoExtractor extractor = new FailureInfoExtractor();

    @Inject
    public FailureInfoAssembler(DlqConfigRepository configRepo) {
        this.configRepo = configRepo;
    }

    /** Message id → FailureInfo, loading each distinct DLQ config once. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Map<UUID, FailureInfo> assembleAll(Collection<DlqMessage> messages) {
        var mappings = new HashMap<UUID, HeaderMapping>();
        var result = new HashMap<UUID, FailureInfo>();
        for (var m : messages) {
            var mapping = mappings.computeIfAbsent(m.getDlqConfigId(), id ->
                configRepo.findById(id).map(c -> c.getHeaderMapping()).orElse(HeaderMapping.empty()));
            result.put(m.getId(), extractor.extract(m.getHeaders(), mapping));
        }
        return result;
    }
}
```
(`computeIfAbsent` caches the `empty()` fallback too, so a missing config is queried once.)

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Wire DTOs and resources**

`MessageResponse`: add component `FailureInfo failureInfo` as last component (import `it.dls.domain.message.FailureInfo`); change `from` to `from(DlqMessage m, FailureInfo info)` passing `info != null ? info : FailureInfo.empty()` last.

`MessagePageResponse.from(MessagePage p, Map<UUID, FailureInfo> infos)`:
```java
            p.messages().stream().map(m -> MessageResponse.from(m, infos.get(m.getId()))).toList(),
```
Resources: inject `@Inject FailureInfoAssembler failureInfoAssembler;` in `MessageResource`, `DlqConfigMessagesResource`, `AllMessagesResource`; replace
- `MessageResponse.from(msg)` → `MessageResponse.from(msg, failureInfoAssembler.assembleAll(List.of(msg)).get(msg.getId()))`
- `MessageResponse.from(updated)` → same with `updated`
- `MessagePageResponse.from(result)` → `MessagePageResponse.from(result, failureInfoAssembler.assembleAll(result.messages()))`
(add `java.util.List` import where needed). Also grep for any other `MessageResponse.from(` / `MessagePageResponse.from(` and fix.

- [ ] **Step 6: REST IT** `infrastructure/api/MessageFailureInfoIT.java` — `@QuarkusTest`, same admin-token pattern; insert a cluster, a DLQ config set to SPRING preset (via `DlqConfigRepository` in a `@Transactional` helper) and a `DlqMessage` (via `MessageRepository.save(DlqMessage.ingest(configId, 0, 5L, Instant.now(), null, new byte[]{1}, null, null, Map.of("kafka_dlt-original-topic","orders","kafka_dlt-original-partition","3","kafka_dlt-exception-message","boom"), false))`). Tests:
```java
    @Test
    void getMessageReturnsFailureInfoFromConfigMapping() {
        given().header("Authorization", "Bearer " + token).get("/api/messages/" + messageId)
            .then().statusCode(200)
            .body("failureInfo.originalTopic", equalTo("orders"))
            .body("failureInfo.originalPartition", equalTo(3))
            .body("failureInfo.exceptionMessage", equalTo("boom"))
            .body("failureInfo.originalOffset", nullValue())
            .body("headers.'kafka_dlt-original-topic'", equalTo("orders"));
    }

    @Test
    void messageListIncludesFailureInfoPerMessage() {
        given().header("Authorization", "Bearer " + token)
            .get("/api/dlq-configs/" + configId + "/messages")
            .then().statusCode(200)
            .body("messages[0].failureInfo.originalTopic", equalTo("orders"));
    }
```
Use the actual list path from `DlqConfigMessagesResource` (`@Path` at its class level). Write the setup fully (cluster via `KafkaClusterRepository`, user via the setup endpoint as in `ClusterResourceIT`).

- [ ] **Step 7: Run IT and full suite** → PASS. `cd backend && ./gradlew test`

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(api): expose normalized failureInfo on messages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — header mapping fields in Create/Edit DLQ Config

**Files:**
- Create: `frontend/src/components/HeaderMappingFields.tsx`
- Modify: `frontend/src/pages/dlqconfig/CreateDlqConfigPage.tsx`, `EditDlqConfigPage.tsx`
- Test: `frontend/e2e/dlqconfig/header-mapping.spec.ts` (new); update `create-dlqconfig.spec.ts` / `edit-dlqconfig.spec.ts` to mock `GET /api/header-presets` in `beforeEach`.

**Interfaces:**
- Consumes: `GET /api/header-presets` → `{preset, mapping}[]`; request fields `headerPreset`, `headerMapping` (Task 5)
- Produces: `HeaderMappingFields` props: `{ preset: HeaderPresetName; mapping: HeaderMappingValue; onChange(preset, mapping): void }` and exported types `HeaderPresetName = 'LEGACY'|'SPRING'|'QUARKUS_SMALLRYE'|'CUSTOM'`, `HeaderFieldValue = { name: string; encoding: 'STRING'|'INT32'|'INT64' } | null`, `HeaderMappingValue` (6 nullable fields named as in API).

- [ ] **Step 1: Failing E2E** `e2e/dlqconfig/header-mapping.spec.ts`

```ts
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const f = (name: string, encoding = 'STRING') => ({ name, encoding })
const presets = [
  { preset: 'LEGACY', mapping: { originalTopic: f('x-original-topic'), originalPartition: null, originalOffset: null, originalTimestamp: null, exceptionMessage: f('x-exception-message'), exceptionStacktrace: null } },
  { preset: 'SPRING', mapping: { originalTopic: f('kafka_dlt-original-topic'), originalPartition: f('kafka_dlt-original-partition', 'INT32'), originalOffset: f('kafka_dlt-original-offset', 'INT64'), originalTimestamp: f('kafka_dlt-original-timestamp', 'INT64'), exceptionMessage: f('kafka_dlt-exception-message'), exceptionStacktrace: f('kafka_dlt-exception-stacktrace') } },
  { preset: 'QUARKUS_SMALLRYE', mapping: { originalTopic: f('dead-letter-topic'), originalPartition: f('dead-letter-partition'), originalOffset: f('dead-letter-offset'), originalTimestamp: null, exceptionMessage: f('dead-letter-reason'), exceptionStacktrace: f('dead-letter-cause') } },
]

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/header-presets', (route) => route.fulfill({ json: presets }))
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq'] } }))
})

// HDR-001: default preset is Legacy and fields are read-only
test('create form defaults to Legacy preset with read-only fields', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, (route) => route.fulfill({ json: [] }))
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await expect(page.getByLabel('Header Preset')).toHaveValue('LEGACY')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('x-original-topic')
  await expect(page.getByLabel('Original Topic header')).toBeDisabled()
})

// HDR-002: choosing Spring fills the fields and sends headerPreset in the POST
test('selecting Spring preset fills mapping and submits it', async ({ page }) => {
  let sent = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: { id: 'x', clusterId: CLUSTER_ID, topicName: 'orders.dlq', displayName: 'O', downloadMode: 'ON_DEMAND', cronExpression: null, batchSize: 100, retentionType: 'MAX_AGE_DAYS', retentionValue: 30, defaultReplayTopic: null, headerPreset: 'SPRING', headerMapping: presets[1].mapping, userAssignments: [] } })
    } else route.fulfill({ json: [] })
  })
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('O')
  await page.getByLabel('Header Preset').selectOption('SPRING')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('kafka_dlt-original-topic')
  await expect(page.getByLabel('Original Partition header')).toHaveValue('kafka_dlt-original-partition')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()
  await expect(page.getByText('DLQ config created')).toBeVisible()
  expect(JSON.parse(sent)).toMatchObject({ headerPreset: 'SPRING' })
})

// HDR-003: Custom makes fields editable and sends the edited mapping
test('custom preset allows editing header names', async ({ page }) => {
  let sent = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: { id: 'x', clusterId: CLUSTER_ID, topicName: 'orders.dlq', displayName: 'O', downloadMode: 'ON_DEMAND', cronExpression: null, batchSize: 100, retentionType: 'MAX_AGE_DAYS', retentionValue: 30, defaultReplayTopic: null, headerPreset: 'CUSTOM', headerMapping: {}, userAssignments: [] } })
    } else route.fulfill({ json: [] })
  })
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('O')
  await page.getByLabel('Header Preset').selectOption('CUSTOM')
  await expect(page.getByLabel('Original Topic header')).toBeEnabled()
  await page.getByLabel('Original Topic header').fill('my-orig-topic')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()
  await expect(page.getByText('DLQ config created')).toBeVisible()
  const body = JSON.parse(sent)
  expect(body.headerPreset).toBe('CUSTOM')
  expect(body.headerMapping.originalTopic).toEqual({ name: 'my-orig-topic', encoding: 'STRING' })
  expect(body.headerMapping.originalPartition).toBeNull()
})

// HDR-004: edit form loads the stored preset
test('edit form shows stored preset and mapping', async ({ page }) => {
  const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: { id: CONFIG_ID, clusterId: CLUSTER_ID, topicName: 'orders.dlq', displayName: 'O', downloadMode: 'ON_DEMAND', cronExpression: null, batchSize: 100, retentionType: 'MAX_AGE_DAYS', retentionValue: 30, defaultReplayTopic: null, headerPreset: 'QUARKUS_SMALLRYE', headerMapping: presets[2].mapping, userAssignments: [] } }))
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await expect(page.getByLabel('Header Preset')).toHaveValue('QUARKUS_SMALLRYE')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('dead-letter-topic')
})
```
Verify the edit route path in `frontend/src/App.tsx` (or the router file) and adjust the URL in HDR-004.

- [ ] **Step 2: Run, verify FAIL**: `cd frontend && npx playwright test e2e/dlqconfig/header-mapping.spec.ts` (dev server on :5173).

- [ ] **Step 3: Implement `HeaderMappingFields.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export type HeaderPresetName = 'LEGACY' | 'SPRING' | 'QUARKUS_SMALLRYE' | 'CUSTOM'
export type HeaderEncoding = 'STRING' | 'INT32' | 'INT64'
export type HeaderFieldValue = { name: string; encoding: HeaderEncoding } | null
export interface HeaderMappingValue {
  originalTopic: HeaderFieldValue
  originalPartition: HeaderFieldValue
  originalOffset: HeaderFieldValue
  originalTimestamp: HeaderFieldValue
  exceptionMessage: HeaderFieldValue
  exceptionStacktrace: HeaderFieldValue
}

interface PresetResponse { preset: Exclude<HeaderPresetName, 'CUSTOM'>; mapping: HeaderMappingValue }

export const EMPTY_MAPPING: HeaderMappingValue = {
  originalTopic: null, originalPartition: null, originalOffset: null,
  originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null,
}

const FIELDS: { key: keyof HeaderMappingValue; label: string; encodings: HeaderEncoding[] }[] = [
  { key: 'originalTopic', label: 'Original Topic', encodings: ['STRING'] },
  { key: 'originalPartition', label: 'Original Partition', encodings: ['STRING', 'INT32'] },
  { key: 'originalOffset', label: 'Original Offset', encodings: ['STRING', 'INT64'] },
  { key: 'originalTimestamp', label: 'Original Timestamp', encodings: ['STRING', 'INT64'] },
  { key: 'exceptionMessage', label: 'Exception Message', encodings: ['STRING'] },
  { key: 'exceptionStacktrace', label: 'Exception Stacktrace', encodings: ['STRING'] },
]

interface Props {
  preset: HeaderPresetName
  mapping: HeaderMappingValue
  onChange: (preset: HeaderPresetName, mapping: HeaderMappingValue) => void
}

export default function HeaderMappingFields({ preset, mapping, onChange }: Props) {
  const { data: presets = [] } = useQuery({
    queryKey: ['header-presets'],
    queryFn: () => apiFetch<PresetResponse[]>('/api/header-presets'),
    staleTime: Infinity,
  })
  const editable = preset === 'CUSTOM'

  function selectPreset(next: HeaderPresetName) {
    if (next === 'CUSTOM') return onChange('CUSTOM', mapping)
    const found = presets.find(p => p.preset === next)
    onChange(next, found ? found.mapping : EMPTY_MAPPING)
  }

  function setField(key: keyof HeaderMappingValue, name: string, encoding: HeaderEncoding) {
    onChange('CUSTOM', { ...mapping, [key]: name.trim() === '' ? null : { name, encoding } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label htmlFor="headerPreset" style={{ fontSize: 12, fontWeight: 500 }}>Header Preset</label>
        <select id="headerPreset" className="select" value={preset}
          onChange={(e) => selectPreset(e.target.value as HeaderPresetName)}>
          <option value="LEGACY">Legacy (x-original-topic)</option>
          <option value="SPRING">Spring Kafka (kafka_dlt-*)</option>
          <option value="QUARKUS_SMALLRYE">Quarkus SmallRye (dead-letter-*)</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </div>
      {FIELDS.map(({ key, label, encodings }) => {
        const value = mapping[key]
        return (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <label htmlFor={`hdr-${key}`} style={{ fontSize: 12, fontWeight: 500 }}>{label} header</label>
              <input id={`hdr-${key}`} className="input" disabled={!editable}
                value={value?.name ?? ''}
                onChange={(e) => setField(key, e.target.value, value?.encoding ?? 'STRING')} />
            </div>
            {encodings.length > 1 && (
              <select aria-label={`${label} encoding`} className="select" disabled={!editable}
                value={value?.encoding ?? 'STRING'}
                onChange={(e) => value && setField(key, value.name, e.target.value as HeaderEncoding)}>
                {encodings.map(enc => <option key={enc} value={enc}>{enc}</option>)}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Wire into `CreateDlqConfigPage.tsx`**

Add imports `useState` and `HeaderMappingFields, { EMPTY_MAPPING, HeaderMappingValue, HeaderPresetName } from '@/components/HeaderMappingFields'`. Inside the component (before `mutation`), hold preset state outside zod (these are not form-registered inputs):
```tsx
  const [headerPreset, setHeaderPreset] = useState<HeaderPresetName>('LEGACY')
  const [headerMapping, setHeaderMapping] = useState<HeaderMappingValue>(EMPTY_MAPPING)
  const { data: presetList } = useQuery({ queryKey: ['header-presets'], queryFn: () => apiFetch<{ preset: HeaderPresetName; mapping: HeaderMappingValue }[]>('/api/header-presets'), staleTime: Infinity })
  useEffect(() => {
    const legacy = presetList?.find(p => p.preset === 'LEGACY')
    if (legacy && headerPreset === 'LEGACY') setHeaderMapping(legacy.mapping)
  }, [presetList, headerPreset])
```
(import `useQuery` from tanstack and `useEffect` from react.) Change `mutationFn` to send `JSON.stringify({ ...data, headerPreset, headerMapping: headerPreset === 'CUSTOM' ? headerMapping : undefined })`. Render before the submit button:
```tsx
          <HeaderMappingFields preset={headerPreset} mapping={headerMapping}
            onChange={(p, m) => { setHeaderPreset(p); setHeaderMapping(m) }} />
```

- [ ] **Step 5: Wire into `EditDlqConfigPage.tsx`**

Extend `DlqConfigDetail` with `headerPreset: HeaderPresetName` and `headerMapping: HeaderMappingValue`. Add the same two `useState`s; in the existing `useEffect(() => { if (config) {...} })` also call `setHeaderPreset(config.headerPreset ?? 'LEGACY'); setHeaderMapping(config.headerMapping ?? EMPTY_MAPPING)`. In `mutationFn` body add `headerPreset, headerMapping: headerPreset === 'CUSTOM' ? headerMapping : undefined`. Render `<HeaderMappingFields .../>` after the Default Replay Topic block, and change that input's placeholder to `"Leave blank to use the original-topic header from the header mapping"`. Update the existing E2E assertion on the old placeholder if one exists (`grep -rn "x-original-topic header" frontend/e2e`).

- [ ] **Step 6: Update existing dlqconfig specs**

In `create-dlqconfig.spec.ts` and `edit-dlqconfig.spec.ts` `beforeEach`, add
```ts
  await page.route('/api/header-presets', (route) => route.fulfill({ json: [] }))
```
and add `headerPreset: 'LEGACY', headerMapping: {}` to their config fixtures where they `reset()` from API data (edit spec).

- [ ] **Step 7: Run dlqconfig specs, verify PASS**

Run: `cd frontend && npx playwright test e2e/dlqconfig` → PASS. Also `npm run build` (type-check) → no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(ui): header preset and mapping fields in DLQ config forms

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — Failure panel and mapping-aware replay topic

**Files:**
- Modify: `frontend/src/pages/messages/MessageDetailPage.tsx` (interface at ~16-30, tabs ~118/204, `resolvedTopic` at 397), `frontend/src/pages/messages/MessageListPage.tsx` (interface ~20, `canBulkReplay` at 168-169)
- Test: `frontend/e2e/messages/failure-info.spec.ts` (new), `e2e/replay/bulk-replay-ui.spec.ts` (revise BULK-003, add BULK-007); update mocks in `e2e/replay/bulk-replay-ui.spec.ts`, `replay-wizard.spec.ts`, `bulk-replay.spec.ts`, `payload-validation.spec.ts`, `replay-failed.spec.ts` to add `failureInfo`.

**Interfaces:**
- Consumes: `failureInfo` on message JSON (Task 6); `targetTopicOverride` on `POST /api/dlq-configs/{id}/messages/bulk-replay` (Task 4)
- Produces: exported-by-convention interface `FailureInfo { originalTopic: string|null; originalPartition: number|null; originalOffset: number|null; originalTimestamp: string|null; exceptionMessage: string|null; exceptionStacktrace: string|null }` declared in each page (types co-located per project convention).

- [ ] **Step 1: Failing E2E** `e2e/messages/failure-info.spec.ts`

Model the setup on an existing `MessageDetailPage` spec (`e2e/messages/*detail*.spec.ts`; reuse its message fixture and routes, including the mandatory `/api/events` SSE mock and `loginAsAdmin`). Fixture message gets:
```ts
failureInfo: { originalTopic: 'orders', originalPartition: 3, originalOffset: 42, originalTimestamp: '2023-11-14T22:13:20Z', exceptionMessage: 'boom', exceptionStacktrace: 'java.lang.IllegalStateException\n\tat Foo.bar' },
headers: { 'kafka_dlt-original-topic': 'orders' },
```
Tests:
```ts
// HDR-005: Failure tab shows normalized info
test('failure tab shows original topic, partition/offset and exception', async ({ page }) => {
  await page.goto(`/messages/${MESSAGE_ID}`)   // use the same URL pattern as the neighbouring spec
  await page.getByRole('tab', { name: 'Failure' }).click()   // match how existing tabs are queried (button vs tab)
  await expect(page.getByText('orders', { exact: true })).toBeVisible()
  await expect(page.getByText('boom')).toBeVisible()
  await expect(page.getByText('java.lang.IllegalStateException')).toBeVisible()
})

// HDR-006: replay wizard preselects topic from failureInfo, not x-original-topic
test('replay wizard resolves topic from failureInfo.originalTopic', async ({ page }) => {
  await page.goto(`/messages/${MESSAGE_ID}`)
  await page.getByRole('button', { name: /replay/i }).first().click()
  await expect(page.getByText('orders').first()).toBeVisible()
})

// HDR-007: no failure info → Failure tab hidden
test('failure tab hidden when failureInfo is empty', async ({ page }) => {
  // re-register the message route with an all-null failureInfo (same URL the other tests use)
  await page.route(`/api/messages/${MESSAGE_ID}`, (route) =>
    route.fulfill({ json: { ...MESSAGE, failureInfo: {
      originalTopic: null, originalPartition: null, originalOffset: null,
      originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null } } }))
  await page.goto(`/messages/${MESSAGE_ID}`)
  await expect(page.getByText('Headers', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Failure', { exact: true })).toHaveCount(0)
})
```
`MESSAGE` and `MESSAGE_ID` are the fixture constants at the top of the new spec (copied from the neighbouring detail spec, plus the `failureInfo` above). Use the same locator style for tabs (`getByRole('tab'|'button', ...)`) as the existing spec does for `Headers`; the `getByText` form above is the fallback if tabs are plain buttons.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `MessageDetailPage.tsx`**

Add to the file:
```tsx
interface FailureInfo {
  originalTopic: string | null
  originalPartition: number | null
  originalOffset: number | null
  originalTimestamp: string | null
  exceptionMessage: string | null
  exceptionStacktrace: string | null
}
```
Add `failureInfo?: FailureInfo` to `MessageDetail`. Extend `type Tab = 'payload' | 'raw' | 'headers' | 'replayed' | 'failure'`. Compute
```tsx
  const fi = msg.failureInfo
  const hasFailureInfo = !!fi && Object.values(fi).some(v => v !== null && v !== undefined)
```
Add to the tabs array (next to the `headers` entry, same shape) `...(hasFailureInfo ? [{ id: 'failure' as const, label: 'Failure' }] : [])`. Add a panel next to the `headers` panel:
```tsx
          {activeTab === 'failure' && fi && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', margin: 0 }}>
                {fi.originalTopic && (<><dt className="t-small">Original topic</dt><dd style={{ margin: 0 }}>{fi.originalTopic}</dd></>)}
                {fi.originalPartition !== null && (<><dt className="t-small">Original partition</dt><dd style={{ margin: 0 }}>{fi.originalPartition}</dd></>)}
                {fi.originalOffset !== null && (<><dt className="t-small">Original offset</dt><dd style={{ margin: 0 }}>{fi.originalOffset}</dd></>)}
                {fi.originalTimestamp && (<><dt className="t-small">Original timestamp</dt><dd style={{ margin: 0 }}>{new Date(fi.originalTimestamp).toLocaleString()}</dd></>)}
                {fi.exceptionMessage && (<><dt className="t-small">Exception</dt><dd style={{ margin: 0 }}>{fi.exceptionMessage}</dd></>)}
              </dl>
              {fi.exceptionStacktrace && (
                <pre className="code-block" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{fi.exceptionStacktrace}</pre>
              )}
            </div>
          )}
```
(Match the actual tab/panel markup used by the `headers` tab at ~line 204/310 — reuse its container classes; if `code-block` does not exist use whatever class the Raw tab uses.) Replace line 397 with `resolvedTopic={msg.failureInfo?.originalTopic ?? null}`.

- [ ] **Step 4: Implement `MessageListPage.tsx`**

Add `failureInfo?: { originalTopic: string | null }` to the message interface (~line 20). Missing headers must not block the user, so replace `canBulkReplay` (lines 168-169) with a hint flag, and add an optional bulk target topic:
```tsx
  const [bulkTopicOverride, setBulkTopicOverride] = useState('')
  const noTopicKnown = !bulkTopicOverride.trim() && configData?.defaultReplayTopic == null &&
    selectedMessages.length > 0 && !selectedMessages.some(m => !!m.failureInfo?.originalTopic)
```
(`useState` is already imported in this file; place the hook with the other `useState`s, before any conditional return.) In `bulkReplayMutation` change the body to
```tsx
      { method: 'POST', body: JSON.stringify({
          messageIds: [...selectedIds],
          targetTopicOverride: bulkTopicOverride.trim() || undefined,
        }) }
```
and in `onSuccess` also `setBulkTopicOverride('')`. In the JSX, immediately before the `Under Review` button inside the selection toolbar fragment add
```tsx
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input
                    data-testid="bulk-topic-override"
                    className="input"
                    placeholder="Target topic (optional)"
                    value={bulkTopicOverride}
                    onChange={(e) => setBulkTopicOverride(e.target.value)}
                    style={{ height: 32, width: 220 }}
                  />
                  {noTopicKnown && (
                    <span data-testid="bulk-no-topic-hint" style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                      No replay topic found for the selection. Enter one, or these messages will be skipped.
                    </span>
                  )}
                </div>
```
and change the Replay button to `disabled={bulkReplayMutation.isPending || bulkDiscardMutation.isPending || bulkUnderReviewMutation.isPending}` with no `title` about a missing topic (delete the `title={!canBulkReplay ...}` prop).

- [ ] **Step 4b: Update and extend `e2e/replay/bulk-replay-ui.spec.ts`**

Rewrite the BULK-003 "disabled" test (lines ~58-72) so it asserts the new behavior, and add an override test (reuse the file's `CONFIG_ID`, `configNoTopic`, `makeMessages`):
```ts
// BULK-003 (revised): no topic known → button still enabled, hint shown, user can type a topic
test('Replay button stays enabled and shows a hint when no replay topic can be inferred', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(2, { headers: {} }), total: 2, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByTestId('message-row').getByRole('checkbox').first().check()

  await expect(page.getByRole('button', { name: /Replay \(1 selected\)/ })).toBeEnabled()
  await expect(page.getByTestId('bulk-no-topic-hint')).toBeVisible()
})

// BULK-007: user-supplied target topic is sent with the bulk replay request
test('bulk replay sends targetTopicOverride when the user enters a topic', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(2, { headers: {} }), total: 2, page: 0, size: 20 } })
  )
  let sent = ''
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages/bulk-replay`, async (route) => {
    sent = route.request().postData() ?? ''
    await route.fulfill({ json: { succeeded: 1, failed: 0 } })
  })
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByTestId('message-row').getByRole('checkbox').first().check()
  await page.getByTestId('bulk-topic-override').fill('orders-manual')
  await expect(page.getByTestId('bulk-no-topic-hint')).toHaveCount(0)
  await page.getByRole('button', { name: /Replay \(1 selected\)/ }).click()
  await expect.poll(() => sent).not.toBe('')
  expect(JSON.parse(sent)).toMatchObject({ targetTopicOverride: 'orders-manual' })
})
```
Keep the existing "enabled case" test but change its fixture to carry `failureInfo.originalTopic` (done in Step 5). Check whether `bulk-replay.spec.ts` asserts the old disabled behavior or `title='No replay topic configured'` (`grep -rn "No replay topic configured" frontend/e2e`) and update it likewise.

- [ ] **Step 5: Update existing replay specs' fixtures**

In each of `bulk-replay-ui.spec.ts` (line ~77 and the `makeMessages` helper), `replay-wizard.spec.ts:20`, `bulk-replay.spec.ts:20`, `payload-validation.spec.ts:20`, `replay-failed.spec.ts:20`: wherever a message fixture has `headers: { 'x-original-topic': 'orders', ... }`, also add `failureInfo: { originalTopic: 'orders', originalPartition: null, originalOffset: null, originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null }`. For fixtures that deliberately have **no** x-original-topic header (the disabled-button case), add an all-null `failureInfo` (or leave `failureInfo` undefined).

- [ ] **Step 6: Run affected specs and build**

Run: `cd frontend && npx playwright test e2e/messages e2e/replay e2e/dlqconfig && npm run build` → all PASS, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(ui): failure info tab and mapping-aware replay topic

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs and requirements

**Files:** Modify `TERMS.md`, `DOMAIN.md`, `EVALUATION.md`, `CLAUDE.md`.

- [ ] **Step 1: `TERMS.md`**
  - Under **Headers** replace the first sentence's fixed names: "…Include technical information such as the original topic and exception details; their names depend on the producing framework and are described by the DLQ's → *Header Mapping*."
  - Replay Topic item 2: "Value of the original-topic header, as named by the DLQ Config's *Header Mapping*".
  - Add new entries (alphabetical): **Header Mapping** — "Per-DLQ-Config declaration of which Kafka header holds each failure attribute (original topic, partition, offset, timestamp, exception message, stacktrace) and how binary values are encoded (STRING, INT32, INT64)." **Header Preset** — "Predefined Header Mapping: LEGACY (`x-original-topic`), SPRING (`kafka_dlt-*`), QUARKUS_SMALLRYE (`dead-letter-*`), or CUSTOM (user-defined)." **Failure Info** — "Normalized view of a Message's failure attributes, derived from its stored Headers through the Header Mapping."
- [ ] **Step 2: `DOMAIN.md`** — add rows to the DlqConfig table: `headerPreset` (`HeaderPreset`, default LEGACY) and `headerMapping` (`HeaderMapping`, six optional `HeaderField{name, encoding}`); add a `### HeaderMapping (Value Object)` section; add `FailureInfo` as a derived read model on DlqMessage.
- [ ] **Step 3: `EVALUATION.md`** — add a section "Header Mapping" with EARS requirements and IDs used in tests: **[HDR-001]** The system shall default new DLQ Configs to the LEGACY Header Preset. **[HDR-002]** When an ADMIN selects a non-custom Header Preset, the system shall apply that preset's mapping and show its header names read-only. **[HDR-003]** Where the CUSTOM preset is selected, the system shall allow editing each header name and permitted encoding. **[HDR-004]** The system shall display the stored preset and mapping when editing a DLQ Config. **[HDR-005]** When a Message's DLQ Config maps failure headers present on the Message, the system shall show them in a Failure view. **[HDR-006]** The system shall resolve the Replay Topic from the header named by the DLQ Config's Header Mapping. **[HDR-007]** If a Message has no mapped failure data, the system shall not show the Failure view. **[HDR-008]** When ingesting a header mapped as INT32/INT64, the system shall store its decimal value; if the byte length is invalid, the system shall store it Base64-encoded and report the field as unknown. **[HDR-010]** If no Replay Topic can be derived from the Header Mapping or DLQ Config, then the system shall still allow the user to start a single or bulk Replay by supplying the target topic, and shall not block ingestion or message viewing. **[HDR-009]** If a CUSTOM mapping has a blank header name or an encoding not permitted for the field, then the system shall reject the request with HTTP 400.
- [ ] **Step 4: `CLAUDE.md`** — add to Codebase Conventions: "**Header mapping:** `DlqConfig.headerMapping` (preset LEGACY/SPRING/QUARKUS_SMALLRYE/CUSTOM) names the failure headers; never hardcode `x-original-topic`. Ingestion decodes binary headers with `HeaderDecoder`; reads go through `FailureInfoExtractor`/`FailureInfoAssembler` (`failureInfo` on message JSON)." Add `| V10 | header_preset + header_mapping on dlq_configs |` to the Flyway table.
- [ ] **Step 5: Commit**

```bash
git add TERMS.md DOMAIN.md EVALUATION.md CLAUDE.md
git commit -m "docs: header mapping terms, domain, requirements

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Final verification**

Run `cd backend && ./gradlew test` and `cd frontend && npm run build && npx playwright test` → everything PASS. Then `git status` should show only the unrelated pre-existing changes (`.gitignore`, `dls.pen`).

---

## Self-Review

**Spec coverage (plus user requirement: missing headers never block the user; topic can always be supplied — single wizard existing, bulk override in T4/T8):** domain (T1), presets (T1), persistence/V10 + LEGACY backfill (T3), ingestion decode + base64 fallback (T2, T4), extractor (T1), replay resolver (T4), API config fields/validation (T5), `failureInfo` in message API (T6), frontend forms (T7), Failure panel + list/detail topic (T8), docs (T9). Out-of-scope items (per-message override, DB presets, raw bytes retention, re-extraction) intentionally absent.

**Placeholder scan:** IT test bodies in Task 5/6 are specified by request/expected-response and must be written out following `ClusterResourceIT`; Task 8 spec reuses an existing spec's fixture — the executor must read it. No TBD left.

**Type consistency:** `HeaderField(name, encoding)`, `HeaderMapping` six fields, `HeaderPreset.mapping()`, `DlqConfig.changeHeaderMapping(preset, custom)`, `getHeaderPreset/getHeaderMapping`, `HeaderDecoder.decode(Map<String,byte[]>, HeaderMapping)`, `FailureInfoExtractor.extract(Map<String,String>, HeaderMapping)`, `FailureInfoAssembler.assembleAll(Collection<DlqMessage>) → Map<UUID,FailureInfo>`, `MessageResponse.from(m, info)` are used consistently across tasks.
