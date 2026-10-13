package it.dls.infrastructure.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Exposes message counts per DLQ config and status as the Prometheus gauge {@code dls_dlq_messages}.
 * Gauges read in-memory values refreshed periodically, so a scrape never touches the database.
 */
@ApplicationScoped
public class DlqMessageMetrics {

    static final String METRIC_NAME = "dls_dlq_messages";

    private static final Logger LOG = Logger.getLogger(DlqMessageMetrics.class);

    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject MeterRegistry registry;

    private record Series(UUID configId, String dlqConfig, String topic, String cluster, MessageStatus status) {}

    private record Registered(AtomicLong value, Meter.Id id) {}

    private final Map<Series, Registered> series = new HashMap<>();

    void onStart(@Observes StartupEvent event) {
        refresh();
    }

    @Scheduled(every = "${dls.metrics.refresh-interval:15s}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledRefresh() {
        refresh();
    }

    synchronized void refresh() {
        try {
            var counts = messageRepo.countByConfigAndStatus();
            Set<Series> seen = new HashSet<>();
            for (DlqConfig config : configRepo.findAll()) {
                var cluster = clusterRepo.findById(config.getClusterId())
                    .map(c -> c.getName()).orElse("unknown");
                var configCounts = counts.getOrDefault(config.getId(), Map.of());
                for (MessageStatus status : MessageStatus.values()) {
                    var key = new Series(config.getId(), config.getDisplayName(), config.getTopicName(), cluster, status);
                    seen.add(key);
                    series.computeIfAbsent(key, this::register)
                        .value().set(configCounts.getOrDefault(status, 0L));
                }
            }
            series.entrySet().removeIf(e -> {
                if (seen.contains(e.getKey())) {
                    return false;
                }
                registry.remove(e.getValue().id());
                return true;
            });
        } catch (RuntimeException e) {
            LOG.warn("Failed to refresh DLQ message metrics", e);
        }
    }

    private Registered register(Series s) {
        var value = new AtomicLong();
        var gauge = Gauge.builder(METRIC_NAME, value, AtomicLong::get)
            .description("Number of messages in a DLQ by status")
            .tag("dlq_config", s.dlqConfig())
            .tag("topic", s.topic())
            .tag("cluster", s.cluster())
            .tag("status", s.status().name())
            .register(registry);
        return new Registered(value, gauge.getId());
    }
}
