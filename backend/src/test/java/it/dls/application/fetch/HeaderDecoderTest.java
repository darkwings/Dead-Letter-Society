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
    void unmappedHeadersAreDecodedAsUtf8() {
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
