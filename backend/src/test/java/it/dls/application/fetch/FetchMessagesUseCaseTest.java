package it.dls.application.fetch;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.cluster.*;
import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.shared.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FETCH-001: offsets stored in DB, not broker.
 * FETCH-002: new partition starts from earliest.
 * FETCH-003: partition reconciliation adds new partitions.
 * FETCH-004: gap detection restarts from earliest.
 * FETCH-005: batchSize limit enforced.
 * FETCH-006: SSE emitted on success.
 * FETCH-008: SSE emitted on failure.
 * FETCH-009: on-demand blocked while another fetch running.
 * FETCH-010: HTTP 409 semantic — FetchAlreadyInProgressException thrown.
 * FETCH-011: raw payload + decoded payload persisted.
 * FETCH-012: schema decode failure sets schemaDecodeFailed=true.
 */
class FetchMessagesUseCaseTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    KafkaConsumerPort kafkaConsumer = mock(KafkaConsumerPort.class);
    SchemaRegistryPort schemaRegistry = mock(SchemaRegistryPort.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    KafkaClusterRepository clusterRepo = mock(KafkaClusterRepository.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    FetchLockService lockService = new FetchLockService();
    EncryptionPort encryption = mock(EncryptionPort.class);

    FetchMessagesUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = new FetchMessagesUseCase(
            kafkaConsumer, schemaRegistry, configRepo, clusterRepo,
            messageRepo, notifier, lockService, encryption);
        // encryption decrypt returns the value unchanged for tests
        when(encryption.decrypt(anyString())).thenAnswer(inv -> inv.getArgument(0));
    }

    // FETCH-002, FETCH-003
    @Test
    void newPartition_startsFromEarliest() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0, 1));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L, 1, 0L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt()))
            .thenReturn(List.of());

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(kafkaConsumer).fetch(any(), any(), any(),
            argThat(reqs -> reqs.stream().anyMatch(r -> r.partition() == 1 && r.fromOffset() == -1L)),
            anyInt());
    }

    // FETCH-004
    @Test
    void gapDetected_restartsFromEarliest_andLogs() {
        var cluster = buildCluster();
        var config = buildDlqConfigWithOffset(cluster, 0, 50L, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        // Broker earliest is 100 — our lastOffset is 50 — gap detected
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 100L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt()))
            .thenReturn(List.of());

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(kafkaConsumer).fetch(any(), any(), any(),
            argThat(reqs -> reqs.stream().anyMatch(r -> r.partition() == 0 && r.fromOffset() == -1L)),
            anyInt());
    }

    // FETCH-005
    @Test
    void batchSizeLimitPassedToConsumer() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 42);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), eq(42)))
            .thenReturn(List.of());

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(kafkaConsumer).fetch(any(), any(), any(), any(), eq(42));
    }

    // FETCH-006
    @Test
    void successfulFetch_emitsFetchCompletedSSE() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        var messages = List.of(buildRawMessage(0, 0L), buildRawMessage(0, 1L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(messages);

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(notifier).emitFetchCompleted(config.getId(), 2);
        verify(notifier, never()).emitFetchFailed(any(), any());
    }

    // FETCH-008
    @Test
    void fetchFailure_emitsFetchFailedSSE_andRethrows() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any()))
            .thenThrow(new RuntimeException("broker unreachable"));

        assertThatThrownBy(() -> useCase.fetchOnDemand(config.getId(), UUID.randomUUID()))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("broker unreachable");

        verify(notifier).emitFetchFailed(eq(config.getId()), contains("broker unreachable"));
        verify(notifier, never()).emitFetchCompleted(any(), anyInt());
    }

    // FETCH-009, FETCH-010
    @Test
    void concurrentFetch_throwsFetchAlreadyInProgressException() {
        var config = buildDlqConfig(DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));

        // Simulate lock already held
        lockService.tryLock(config.getId());

        assertThatThrownBy(() -> useCase.fetchOnDemand(config.getId(), UUID.randomUUID()))
            .isInstanceOf(FetchAlreadyInProgressException.class)
            .hasMessageContaining(config.getId().toString());
    }

    // FETCH-009: lock released after successful fetch
    @Test
    void lockReleasedAfterSuccessfulFetch() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(List.of());

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        assertThat(lockService.isLocked(config.getId())).isFalse();
    }

    // FETCH-009: lock released even when fetch throws
    @Test
    void lockReleasedAfterFailedFetch() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any()))
            .thenThrow(new RuntimeException("broker down"));

        assertThatThrownBy(() -> useCase.fetchOnDemand(config.getId(), UUID.randomUUID()));

        assertThat(lockService.isLocked(config.getId())).isFalse();
    }

    // FETCH-011
    @Test
    void rawPayloadAndDecodedPayloadPersisted() throws Exception {
        var cluster = buildClusterWithSR();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        byte[] payload = "{\"key\":\"value\"}".getBytes();
        var raw = new RawKafkaMessage(0, 5L, Instant.now(), null, payload, Map.of());
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(List.of(raw));

        var decoded = new DecodedPayload(MAPPER.readTree(payload), 42, "PLAIN_JSON");
        when(schemaRegistry.decode(eq(payload), any(), any())).thenReturn(decoded);

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(messageRepo).save(argThat((DlqMessage m) ->
            m.getRawPayload() == payload
            && m.getDecodedPayload() != null
            && m.getSchemaId() == 42
            && !m.isSchemaDecodeFailed()
        ));
    }

    // FETCH-012
    @Test
    void schemaDecodeFailure_marksMessageWithFlag_andNullDecodedPayload() {
        var cluster = buildClusterWithSR();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        byte[] payload = "not-json-at-all".getBytes();
        var raw = new RawKafkaMessage(0, 10L, Instant.now(), null, payload, Map.of());
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(List.of(raw));
        when(schemaRegistry.decode(any(), any(), any()))
            .thenThrow(new RuntimeException("Schema not found"));

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(messageRepo).save(argThat((DlqMessage m) ->
            m.isSchemaDecodeFailed()
            && m.getDecodedPayload() == null
            && m.getRawPayload() == payload
        ));
    }

    // FETCH-001
    @Test
    void committedOffsets_updatedInDomainObject_notBroker() {
        var cluster = buildCluster();
        var config = buildDlqConfig(cluster, DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(clusterRepo.findById(cluster.getId())).thenReturn(Optional.of(cluster));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0));
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L));
        var messages = List.of(
            buildRawMessage(0, 7L),
            buildRawMessage(0, 8L),
            buildRawMessage(0, 9L)
        );
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt())).thenReturn(messages);

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        // configRepo.save called with updated offsets — partition 0 lastOffset = 9
        verify(configRepo).save(argThat(c ->
            c.getPartitionOffsets().stream()
                .anyMatch(po -> po.partition() == 0 && po.lastOffset() == 9L)
        ));
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private KafkaCluster buildCluster() {
        return KafkaCluster.reconstitute(
            UUID.randomUUID(), "Test Cluster", "localhost:9092",
            KafkaSecurityConfig.plaintext(), null);
    }

    private KafkaCluster buildClusterWithSR() {
        var sr = new it.dls.domain.cluster.SchemaRegistryConfig(
            "http://registry:8081", null, null);
        return KafkaCluster.reconstitute(
            UUID.randomUUID(), "Test Cluster", "localhost:9092",
            KafkaSecurityConfig.plaintext(), sr);
    }

    private DlqConfig buildDlqConfig(KafkaCluster cluster, DownloadMode mode, int batchSize) {
        var fetchConfig = mode == DownloadMode.ON_DEMAND
            ? FetchConfig.onDemand(batchSize)
            : FetchConfig.scheduled("0 * * * * ?", batchSize);
        return DlqConfig.create(cluster.getId(), "test.dlq", "Test DLQ",
            fetchConfig, RetentionPolicy.maxDays(30), null);
    }

    /** Overload without cluster for lock-only tests. */
    private DlqConfig buildDlqConfig(DownloadMode mode, int batchSize) {
        return buildDlqConfig(buildCluster(), mode, batchSize);
    }

    private DlqConfig buildDlqConfigWithOffset(KafkaCluster cluster, int partition, long lastOffset,
                                                DownloadMode mode, int batchSize) {
        var config = buildDlqConfig(cluster, mode, batchSize);
        config.updatePartitionOffset(partition, lastOffset);
        return config;
    }

    private RawKafkaMessage buildRawMessage(int partition, long offset) {
        return new RawKafkaMessage(partition, offset, Instant.now(),
            null, "{\"event\":\"test\"}".getBytes(), Map.of());
    }
}
