package it.dls.application.replay;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.cluster.*;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.*;
import it.dls.domain.shared.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ReplayMessageUseCaseTest {

    KafkaProducerPort producer = mock(KafkaProducerPort.class);
    SchemaRegistryPort schemaRegistry = mock(SchemaRegistryPort.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    it.dls.domain.dlqconfig.DlqConfigRepository configRepo = mock(it.dls.domain.dlqconfig.DlqConfigRepository.class);
    KafkaClusterRepository clusterRepo = mock(KafkaClusterRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    ReplayAuditRecordRepository auditRepo = mock(ReplayAuditRecordRepository.class);
    EncryptionPort encryption = mock(EncryptionPort.class);

    ReplayMessageUseCase useCase;

    private static final UUID MSG_ID = UUID.randomUUID();
    private static final UUID CONFIG_ID = UUID.randomUUID();
    private static final UUID CLUSTER_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new ReplayMessageUseCase();
        injectField(useCase, "producer", producer);
        injectField(useCase, "schemaRegistry", schemaRegistry);
        injectField(useCase, "messageRepo", messageRepo);
        injectField(useCase, "configRepo", configRepo);
        injectField(useCase, "clusterRepo", clusterRepo);
        injectField(useCase, "notifier", notifier);
        injectField(useCase, "auditRepo", auditRepo);
        injectField(useCase, "encryption", encryption);

        when(encryption.decrypt(anyString())).thenAnswer(inv -> "decrypted-" + inv.getArgument(0));
    }

    @Test
    void successfulReplay_transitionsToReplayed() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = plaintextCluster(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

        var result = useCase.replay(MSG_ID, null, null, USER_ID);

        assertThat(result.success()).isTrue();
        assertThat(result.targetTopic()).isEqualTo("orders");
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAYED);
        verify(producer).publish(eq("localhost:9092"), any(), eq("orders"), any(), any(), any());
        verify(messageRepo).save(msg);
        verify(auditRepo).save(any(ReplayAuditRecord.class));
        verify(notifier).emitMessageStatusChanged(MSG_ID, CONFIG_ID, "REPLAYED");
    }

    @Test
    void failedPublish_transitionsToReplayFailed() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), null);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = plaintextCluster(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
        doThrow(new RuntimeException("broker unavailable")).when(producer)
            .publish(any(), any(), any(), any(), any(), any());

        var result = useCase.replay(MSG_ID, null, null, USER_ID);

        assertThat(result.success()).isFalse();
        assertThat(result.failureReason()).contains("broker unavailable");
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAY_FAILED);
        verify(notifier).emitMessageStatusChanged(MSG_ID, CONFIG_ID, "REPLAY_FAILED");
    }

    @Test
    void wizardTopicOverrideTakesPrecedence() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), null);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = plaintextCluster(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

        var result = useCase.replay(MSG_ID, "orders-fixed", null, USER_ID);

        assertThat(result.targetTopic()).isEqualTo("orders-fixed");
        verify(producer).publish(any(), any(), eq("orders-fixed"), any(), any(), any());
    }

    @Test
    void editedPayload_withSchemaAndSR_encodesWithTargetTopicSchema() throws Exception {
        var mapper = new ObjectMapper();
        var edited = mapper.readTree("{\"amount\":50.00}");
        var encoded = new byte[]{0x00, 0x00, 0x00, 0x00, 0x2a, 0x42}; // schema id 42 (orders-value)
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7); // 7 = DLQ schema id
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
        when(schemaRegistry.resolveLatestSchemaId(eq("orders-value"), any(), any())).thenReturn(42);
        when(schemaRegistry.validate(any(), eq(42), any(), any())).thenReturn(ValidationResult.ok());
        when(schemaRegistry.encode(eq(edited), eq(42), any(), any())).thenReturn(encoded);

        var result = useCase.replay(MSG_ID, null, edited, USER_ID);

        assertThat(result.success()).isTrue();
        verify(schemaRegistry).resolveLatestSchemaId(eq("orders-value"), any(), any());
        verify(schemaRegistry).encode(eq(edited), eq(42), any(), any());
        var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
        assertThat(payloadCaptor.getValue()).isEqualTo(encoded);
        assertThat(msg.getReplayedDecodedPayload()).isEqualTo(edited);
        assertThat(msg.getDecodedPayload()).isNull(); // original unchanged
    }

    @Test
    void editedPayload_noSR_sendsUtf8Json() throws Exception {
        var mapper = new ObjectMapper();
        var edited = mapper.readTree("{\"amount\":50.00}");
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = plaintextCluster(CLUSTER_ID); // no SR
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

        var result = useCase.replay(MSG_ID, null, edited, USER_ID);

        assertThat(result.success()).isTrue();
        verify(schemaRegistry, never()).encode(any(), anyInt(), any(), any());
        var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
        assertThat(new String(payloadCaptor.getValue(), java.nio.charset.StandardCharsets.UTF_8))
            .contains("50.0");
    }

    @Test
    void noEditedPayload_sendsRawPayload() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

        useCase.replay(MSG_ID, null, null, USER_ID);

        verify(schemaRegistry, never()).encode(any(), anyInt(), any(), any());
        var payloadCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(producer).publish(any(), any(), any(), any(), payloadCaptor.capture(), any());
        assertThat(payloadCaptor.getValue()).isEqualTo(new byte[]{1, 2, 3}); // rawPayload from message()
    }

    @Test
    void encodeFailure_transitionsToReplayFailed() throws Exception {
        var mapper = new ObjectMapper();
        var edited = mapper.readTree("{\"amount\":50.00}");
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
        when(schemaRegistry.resolveLatestSchemaId(eq("orders-value"), any(), any())).thenReturn(42);
        when(schemaRegistry.validate(any(), eq(42), any(), any())).thenReturn(ValidationResult.ok());
        when(schemaRegistry.encode(any(), eq(42), any(), any()))
            .thenThrow(new RuntimeException("Encode failed: schema mismatch"));

        var result = useCase.replay(MSG_ID, null, edited, USER_ID);

        assertThat(result.success()).isFalse();
        assertThat(result.failureReason()).contains("Encode failed");
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAY_FAILED);
        verify(auditRepo).save(any(ReplayAuditRecord.class));
        verify(notifier).emitMessageStatusChanged(MSG_ID, CONFIG_ID, "REPLAY_FAILED");
    }

    @Test
    void editedPayload_withInvalidSchema_throwsSchemaValidationException() throws Exception {
        var mapper = new ObjectMapper();
        var edited = mapper.readTree("{\"amount\":\"not-a-number\"}");
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), 7);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = clusterWithSchemaRegistry(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));
        when(schemaRegistry.resolveLatestSchemaId(eq("orders-value"), any(), any())).thenReturn(42);
        when(schemaRegistry.validate(any(), eq(42), any(), any()))
            .thenReturn(ValidationResult.fail("amount must be a number"));

        assertThatThrownBy(() -> useCase.replay(MSG_ID, null, edited, USER_ID))
            .isInstanceOf(SchemaValidationException.class)
            .hasMessageContaining("amount must be a number");
        verify(producer, never()).publish(any(), any(), any(), any(), any(), any());
    }

    @Test
    void messageNotFound_throwsIllegalArgumentException() {
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.replay(MSG_ID, null, null, USER_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining(MSG_ID.toString());
    }

    @Test
    void replayHeaders_containDlsMetadata() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW,
            Map.of("x-original-topic", "orders"), null);
        var config = config(CONFIG_ID, CLUSTER_ID);
        var cluster = plaintextCluster(CLUSTER_ID);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(cluster));

        useCase.replay(MSG_ID, null, null, USER_ID);

        @SuppressWarnings("unchecked")
        var headersCaptor = ArgumentCaptor.forClass(java.util.Map.class);
        verify(producer).publish(any(), any(), any(), any(), any(), headersCaptor.capture());
        var headers = headersCaptor.getValue();
        assertThat(headers).containsKey("x-dls-replayed-at");
        assertThat(headers).containsKey("x-dls-replayed-by");
    }

    private DlqMessage message(UUID id, UUID configId, MessageStatus status,
                                Map<String, String> headers, Integer schemaId) {
        return DlqMessage.reconstitute(id, configId, 0, 0L, Instant.now(),
            null, new byte[]{1, 2, 3}, null, schemaId, headers, status, false, Instant.now(),
            null, null);
    }

    private DlqConfig config(UUID id, UUID clusterId) {
        return DlqConfig.reconstitute(id, clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxCount(1000),
            null, null, null);
    }

    private KafkaCluster plaintextCluster(UUID id) {
        return KafkaCluster.reconstitute(id, "test-cluster", "localhost:9092",
            KafkaSecurityConfig.plaintext(), null);
    }

    private KafkaCluster clusterWithSchemaRegistry(UUID id) {
        var sr = new SchemaRegistryConfig("http://sr:8081", null, null, null);
        return KafkaCluster.reconstitute(id, "test-cluster", "localhost:9092",
            KafkaSecurityConfig.plaintext(), sr);
    }

    private static void injectField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("Inject failed: " + fieldName, e);
        }
    }

    @Test
    void replayWithoutOriginalTopicHeaderSucceedsWhenWizardSuppliesTopic() {
        var msg = message(MSG_ID, CONFIG_ID, MessageStatus.NEW, Map.of(), null);
        when(messageRepo.findById(MSG_ID)).thenReturn(Optional.of(msg));
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config(CONFIG_ID, CLUSTER_ID)));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(plaintextCluster(CLUSTER_ID)));

        var result = useCase.replay(MSG_ID, "orders-manual", null, USER_ID);

        assertThat(result.success()).isTrue();
        verify(producer).publish(any(), any(), eq("orders-manual"), any(), any(), any());
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.REPLAYED);
    }
}
