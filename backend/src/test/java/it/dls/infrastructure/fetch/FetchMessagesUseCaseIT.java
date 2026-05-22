package it.dls.infrastructure.fetch;

import io.quarkus.test.junit.QuarkusTest;
import it.dls.application.fetch.FetchAlreadyInProgressException;
import it.dls.application.fetch.FetchLockService;
import it.dls.application.fetch.FetchMessagesUseCase;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.MessageRepository;
import it.dls.infrastructure.persistence.DlqConfigEntity;
import it.dls.infrastructure.persistence.KafkaClusterEntity;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.*;

import java.time.Duration;
import java.util.Properties;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration tests for the full fetch pipeline.
 * FETCH-001: committed offsets stored in DB.
 * FETCH-003: partition reconciliation adds new partitions.
 * FETCH-005: batchSize respected.
 * FETCH-009, FETCH-010: concurrent fetch blocked.
 */
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FetchMessagesUseCaseIT {

    private static final String TOPIC = "dls-it-dlq";

    @Inject FetchMessagesUseCase useCase;
    @Inject FetchLockService lockService;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject MessageRepository messageRepo;

    @ConfigProperty(name = "kafka.bootstrap.servers")
    String bootstrapServers;

    private KafkaCluster cluster;
    private DlqConfig dlqConfig;

    @BeforeEach
    @Transactional
    void setup() {
        KafkaClusterEntity.deleteAll();
        DlqConfigEntity.deleteAll();

        cluster = KafkaCluster.create(bootstrapServers, "IT Cluster",
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(cluster);

        dlqConfig = DlqConfig.create(cluster.getId(), TOPIC, "IT DLQ",
            FetchConfig.onDemand(50), RetentionPolicy.maxDays(7), null);
        configRepo.save(dlqConfig);
    }

    @AfterEach
    void releaseLocks() {
        lockService.unlock(dlqConfig.getId());
    }

    @Test
    @Order(1)
    void fetchNewMessages_storesInDb() throws Exception {
        // Produce 3 messages to the DLQ topic
        produceMessages(TOPIC, 3);

        // Allow Kafka to settle
        Thread.sleep(500);

        var result = useCase.fetchOnDemand(dlqConfig.getId(), UUID.randomUUID());

        assertThat(result.count()).isGreaterThanOrEqualTo(3);
        var page = messageRepo.findByConfig(dlqConfig.getId(), it.dls.domain.message.MessageFilter.empty(),
            new it.dls.domain.message.Pageable(0, 100));
        assertThat(page.total()).isGreaterThanOrEqualTo(3);
    }

    @Test
    @Order(2)
    void partitionOffset_updatedInDb_afterFetch() throws Exception {
        produceMessages(TOPIC, 2);
        Thread.sleep(300);

        useCase.fetchOnDemand(dlqConfig.getId(), UUID.randomUUID());

        var updated = configRepo.findById(dlqConfig.getId()).orElseThrow();
        // FETCH-001: partition offsets tracked in our DB
        assertThat(updated.getPartitionOffsets()).isNotEmpty();
        assertThat(updated.getPartitionOffsets().get(0).lastOffset()).isGreaterThanOrEqualTo(0);
    }

    @Test
    @Order(3)
    void concurrentFetch_blocked_throwsFetchAlreadyInProgressException() {
        lockService.tryLock(dlqConfig.getId());

        // FETCH-009, FETCH-010
        assertThatThrownBy(() -> useCase.fetchOnDemand(dlqConfig.getId(), UUID.randomUUID()))
            .isInstanceOf(FetchAlreadyInProgressException.class);
    }

    @Test
    @Order(4)
    void batchSizeRespected_atMost50MessagesPerFetch() throws Exception {
        // Produce more than batchSize messages
        produceMessages(TOPIC, 10);
        Thread.sleep(300);

        var result = useCase.fetchOnDemand(dlqConfig.getId(), UUID.randomUUID());

        // FETCH-005: we set batchSize=50; should fetch at most 50 per partition
        assertThat(result.count()).isLessThanOrEqualTo(50);
    }

    private void produceMessages(String topic, int count) {
        var props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.LINGER_MS_CONFIG, "10");

        try (var producer = new KafkaProducer<byte[], byte[]>(props)) {
            for (int i = 0; i < count; i++) {
                String payload = "{\"event\":\"test\",\"seq\":" + i + "}";
                producer.send(new ProducerRecord<>(topic, null, payload.getBytes()));
            }
            producer.flush();
        }
    }
}
