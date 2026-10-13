package it.dls.infrastructure.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DlqMessageMetricsTest {

    MessageRepository messageRepo = mock(MessageRepository.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    KafkaClusterRepository clusterRepo = mock(KafkaClusterRepository.class);
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    DlqMessageMetrics metrics;

    UUID clusterId = UUID.randomUUID();
    UUID configId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        metrics = new DlqMessageMetrics();
        metrics.messageRepo = messageRepo;
        metrics.configRepo = configRepo;
        metrics.clusterRepo = clusterRepo;
        metrics.registry = registry;

        var cluster = KafkaCluster.reconstitute(clusterId, "prod-cluster", "localhost:9092", null, null);
        when(clusterRepo.findById(clusterId)).thenReturn(Optional.of(cluster));
        when(configRepo.findAll()).thenReturn(List.of(config("Orders DLQ")));
        when(messageRepo.countByConfigAndStatus()).thenReturn(Map.of());
    }

    private DlqConfig config(String displayName) {
        return DlqConfig.reconstitute(configId, clusterId, "orders.dlq", displayName,
            null, null, null, List.of(), List.of());
    }

    private Gauge gauge(String displayName, MessageStatus status) {
        return registry.find("dls_dlq_messages")
            .tag("dlq_config", displayName).tag("topic", "orders.dlq")
            .tag("cluster", "prod-cluster").tag("status", status.name())
            .gauge();
    }

    @Test
    void refresh_emitsAllStatusesWithZeroForEmptyOnes() {
        when(messageRepo.countByConfigAndStatus())
            .thenReturn(Map.of(configId, Map.of(MessageStatus.NEW, 12L)));

        metrics.refresh();

        for (MessageStatus status : MessageStatus.values()) {
            var g = gauge("Orders DLQ", status);
            assertThat(g).as(status.name()).isNotNull();
            assertThat(g.value()).as(status.name()).isEqualTo(status == MessageStatus.NEW ? 12.0 : 0.0);
        }
    }

    @Test
    void refresh_updatesGaugeValueOnNextRefresh() {
        metrics.refresh();
        when(messageRepo.countByConfigAndStatus())
            .thenReturn(Map.of(configId, Map.of(MessageStatus.REPLAYED, 3L)));

        metrics.refresh();

        assertThat(gauge("Orders DLQ", MessageStatus.REPLAYED).value()).isEqualTo(3.0);
    }

    @Test
    void refresh_removesSeriesOfDeletedConfig() {
        metrics.refresh();
        assertThat(registry.find("dls_dlq_messages").gauges()).hasSize(MessageStatus.values().length);

        when(configRepo.findAll()).thenReturn(List.of());
        metrics.refresh();

        assertThat(registry.find("dls_dlq_messages").gauges()).isEmpty();
    }

    @Test
    void refresh_reregistersSeriesWhenConfigIsRenamed() {
        metrics.refresh();
        when(configRepo.findAll()).thenReturn(List.of(config("Orders Renamed")));

        metrics.refresh();

        assertThat(registry.find("dls_dlq_messages").gauges()).hasSize(MessageStatus.values().length);
        assertThat(gauge("Orders DLQ", MessageStatus.NEW)).isNull();
        assertThat(gauge("Orders Renamed", MessageStatus.NEW)).isNotNull();
    }
}
