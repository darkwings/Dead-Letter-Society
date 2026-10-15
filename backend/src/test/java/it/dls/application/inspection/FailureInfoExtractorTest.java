package it.dls.application.inspection;

import it.dls.domain.dlqconfig.HeaderEncoding;
import it.dls.domain.dlqconfig.HeaderField;
import it.dls.domain.dlqconfig.HeaderMapping;
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
        var mapping = new HeaderMapping(null, null, null,
            new HeaderField("ts", HeaderEncoding.STRING), null, null);
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
            HeaderMapping.empty())).isEqualTo(FailureInfo.empty());
    }
}
