package it.dls.application.replay;

import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.DlqMessage;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class ReplayTopicResolverTest {

    private final ReplayTopicResolver resolver = new ReplayTopicResolver();

    @Test
    void usesWizardOverrideWhenPresent() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithOverride("orders-fixed");
        assertThat(resolver.resolve(msg, config, "orders-wizard")).isEqualTo("orders-wizard");
    }

    @Test
    void wizardOverrideTakesPrecedenceOverConfig() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithOverride("orders-fixed");
        assertThat(resolver.resolve(msg, config, "orders-wizard")).isEqualTo("orders-wizard");
    }

    @Test
    void configDefaultTakesPrecedenceOverHeader() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithOverride("orders-fixed");
        assertThat(resolver.resolve(msg, config, null)).isEqualTo("orders-fixed");
    }

    @Test
    void fallsBackToOriginalTopicHeader() {
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithNoOverride();
        assertThat(resolver.resolve(msg, config, null)).isEqualTo("orders");
    }

    @Test
    void throwsWhenNoTopicResolvable() {
        var msg = messageWithHeader("unrelated", "value");
        var config = configWithNoOverride();
        assertThatThrownBy(() -> resolver.resolve(msg, config, null))
            .isInstanceOf(ReplayTopicNotResolvableException.class);
    }

    private DlqMessage messageWithHeader(String key, String value) {
        return DlqMessage.ingest(UUID.randomUUID(), 0, 0L, Instant.now(),
            null, new byte[]{1}, null, null, Map.of(key, value), false);
    }

    private DlqConfig configWithOverride(String topic) {
        var config = DlqConfig.create(UUID.randomUUID(), "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxCount(1000), null);
        config.setDefaultReplayTopic(topic);
        return config;
    }

    private DlqConfig configWithNoOverride() {
        return DlqConfig.create(UUID.randomUUID(), "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxCount(1000), null);
    }

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
}
