package it.dls.application.retention;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.*;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.*;

@QuarkusTest
class RetentionJobIT {

    @Inject RetentionJob retentionJob;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject MessageRepository messageRepo;

    private final AtomicLong offsetSeq = new AtomicLong(0);

    private KafkaCluster savedCluster() {
        var c = KafkaCluster.create("localhost:9092", "cluster-" + UUID.randomUUID(),
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(c);
        return c;
    }

    private DlqConfig savedConfig(UUID clusterId, RetentionPolicy policy) {
        var config = DlqConfig.create(clusterId, "dlq-" + UUID.randomUUID(), "Test DLQ",
            FetchConfig.onDemand(100), policy, null);
        configRepo.save(config);
        return config;
    }

    private void ingestMessage(UUID dlqConfigId, Instant kafkaTimestamp) {
        var msg = DlqMessage.reconstitute(
            UUID.randomUUID(), dlqConfigId, 0, offsetSeq.getAndIncrement(),
            kafkaTimestamp, null, new byte[]{1}, null, null, Map.of(),
            MessageStatus.NEW, false, Instant.now(),
            null, null);
        messageRepo.save(msg);
    }

    @Test
    @TestTransaction
    void maxAgeDays_deletesOldMessages_keepsRecent() {
        var cluster = savedCluster();
        var config = savedConfig(cluster.getId(), RetentionPolicy.maxDays(1));

        ingestMessage(config.getId(), Instant.now().minus(2, ChronoUnit.DAYS));
        ingestMessage(config.getId(), Instant.now());

        retentionJob.applyRetention();

        var remaining = messageRepo.findByConfig(config.getId(), MessageFilter.empty(), new Pageable(0, 500));
        assertThat(remaining.total()).isEqualTo(1);
    }

    @Test
    @TestTransaction
    void maxCount_deletesExceedingMessages() {
        var cluster = savedCluster();
        var config = savedConfig(cluster.getId(), RetentionPolicy.maxCount(2));

        for (int i = 0; i < 5; i++) {
            ingestMessage(config.getId(), Instant.now().minus(i, ChronoUnit.HOURS));
        }

        retentionJob.applyRetention();

        var remaining = messageRepo.findByConfig(config.getId(), MessageFilter.empty(), new Pageable(0, 500));
        assertThat(remaining.total()).isEqualTo(2);
    }

    @Test
    @TestTransaction
    void retentionScopedToConfig_doesNotDeleteOtherConfigMessages() {
        var cluster = savedCluster();
        var configA = savedConfig(cluster.getId(), RetentionPolicy.maxDays(1));
        var configB = savedConfig(cluster.getId(), RetentionPolicy.maxDays(30));

        ingestMessage(configA.getId(), Instant.now().minus(2, ChronoUnit.DAYS));
        ingestMessage(configB.getId(), Instant.now().minus(2, ChronoUnit.DAYS));

        retentionJob.applyRetention();

        assertThat(messageRepo.findByConfig(configA.getId(), MessageFilter.empty(), new Pageable(0, 500)).total())
            .isEqualTo(0);
        assertThat(messageRepo.findByConfig(configB.getId(), MessageFilter.empty(), new Pageable(0, 500)).total())
            .isEqualTo(1);
    }
}
