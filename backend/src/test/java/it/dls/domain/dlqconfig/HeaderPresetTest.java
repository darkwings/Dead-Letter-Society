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
