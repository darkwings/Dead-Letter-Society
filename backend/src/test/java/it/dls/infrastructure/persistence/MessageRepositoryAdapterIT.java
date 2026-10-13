package it.dls.infrastructure.persistence;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@QuarkusTest
class MessageRepositoryAdapterIT {

    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;

    private UUID savedConfigId() {
        var cluster = KafkaCluster.create("localhost:9092", "test-cluster-" + UUID.randomUUID(),
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(cluster);
        var config = DlqConfig.create(cluster.getId(), "test-dlq-" + UUID.randomUUID(), "Test DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxDays(7), null);
        configRepo.save(config);
        return config.getId();
    }

    private DlqMessage message(UUID configId, int partition, long offset) {
        return DlqMessage.ingest(configId, partition, offset, Instant.now(),
            null, new byte[]{1}, null, null, Map.of(), false);
    }

    @Test
    @TestTransaction
    void saveNewMessage_persists() {
        var configId = savedConfigId();
        var msg = message(configId, 0, 0L);
        messageRepo.save(msg);
        assertThat(messageRepo.findById(msg.getId())).isPresent();
    }

    @Test
    @TestTransaction
    void saveWithSameNaturalKey_skipsDuplicate() {
        var configId = savedConfigId();
        var first = message(configId, 2, 0L);
        messageRepo.save(first);

        // Second call with same (configId, partition=2, offset=0) — different UUID
        var duplicate = message(configId, 2, 0L);
        assertThatCode(() -> messageRepo.save(duplicate)).doesNotThrowAnyException();

        // Only the first message exists; duplicate was silently skipped
        assertThat(messageRepo.findById(first.getId())).isPresent();
        assertThat(messageRepo.findById(duplicate.getId())).isEmpty();
    }

    @Test
    @TestTransaction
    void saveWithDifferentOffsets_bothPersist() {
        var configId = savedConfigId();
        messageRepo.save(message(configId, 2, 0L));
        messageRepo.save(message(configId, 2, 1L));
        messageRepo.save(message(configId, 3, 0L));

        // All three have distinct natural keys — all should exist
        long count = DlqMessageEntity.count("dlqConfigId", configId);
        assertThat(count).isEqualTo(3);
    }

    @Test
    @TestTransaction
    void countByConfigAndStatus_groupsPerConfigAndStatus() {
        var configA = savedConfigId();
        var configB = savedConfigId();
        messageRepo.save(message(configA, 0, 0L));
        messageRepo.save(message(configA, 0, 1L));
        var replayed = message(configA, 0, 2L);
        replayed.transitionTo(it.dls.domain.message.MessageStatus.REPLAYED);
        messageRepo.save(replayed);
        messageRepo.save(message(configB, 0, 0L));

        var counts = messageRepo.countByConfigAndStatus();

        assertThat(counts.get(configA)).containsOnly(
            entry(it.dls.domain.message.MessageStatus.NEW, 2L),
            entry(it.dls.domain.message.MessageStatus.REPLAYED, 1L));
        assertThat(counts.get(configB)).containsOnly(
            entry(it.dls.domain.message.MessageStatus.NEW, 1L));
    }
}
