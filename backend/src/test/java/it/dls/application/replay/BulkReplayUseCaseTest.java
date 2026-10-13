package it.dls.application.replay;

import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.ReplayAuditRecordRepository;
import it.dls.domain.shared.EncryptionPort;
import it.dls.domain.shared.KafkaProducerPort;
import it.dls.domain.shared.NotificationPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class BulkReplayUseCaseTest {

    KafkaProducerPort producer = mock(KafkaProducerPort.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    KafkaClusterRepository clusterRepo = mock(KafkaClusterRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    ReplayAuditRecordRepository auditRepo = mock(ReplayAuditRecordRepository.class);
    EncryptionPort encryption = mock(EncryptionPort.class);
    BulkReplayUseCase useCase;

    static final UUID CONFIG_ID = UUID.randomUUID();
    static final UUID CLUSTER_ID = UUID.randomUUID();
    static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new BulkReplayUseCase();
        inject("producer", producer);
        inject("messageRepo", messageRepo);
        inject("configRepo", configRepo);
        inject("clusterRepo", clusterRepo);
        inject("notifier", notifier);
        inject("auditRepo", auditRepo);
        inject("encryption", encryption);
        when(encryption.decrypt(anyString())).thenAnswer(i -> i.getArgument(0));
        var config = DlqConfig.reconstitute(CONFIG_ID, CLUSTER_ID, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxCount(1000), null, null, null);
        when(configRepo.findById(CONFIG_ID)).thenReturn(Optional.of(config));
        when(clusterRepo.findById(CLUSTER_ID)).thenReturn(Optional.of(
            KafkaCluster.reconstitute(CLUSTER_ID, "c", "localhost:9092", KafkaSecurityConfig.plaintext(), null)));
    }

    private DlqMessage msg(Map<String, String> headers) {
        var m = DlqMessage.reconstitute(UUID.randomUUID(), CONFIG_ID, 0, 0L, Instant.now(),
            null, new byte[]{1}, null, null, headers, MessageStatus.NEW, false, Instant.now(), null, null);
        when(messageRepo.findById(m.getId())).thenReturn(Optional.of(m));
        return m;
    }

    @Test
    void messagesWithoutTopicHeaderCountAsFailedButDoNotAbortTheBatch() {
        var withHeader = msg(Map.of("x-original-topic", "orders"));
        var without = msg(Map.of());
        var result = useCase.bulkReplay(CONFIG_ID, List.of(without.getId(), withHeader.getId()), USER_ID);
        assertThat(result.succeeded()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(without.getStatus()).isEqualTo(MessageStatus.NEW);
    }

    @Test
    void targetTopicOverrideReplaysMessagesLackingTheHeader() {
        var a = msg(Map.of());
        var b = msg(Map.of("unrelated", "x"));
        var result = useCase.bulkReplay(CONFIG_ID, List.of(a.getId(), b.getId()), USER_ID, "orders-manual");
        assertThat(result.succeeded()).isEqualTo(2);
        assertThat(result.failed()).isZero();
        verify(producer, times(2)).publish(any(), any(), eq("orders-manual"), any(), any(), any());
    }

    @Test
    void blankOverrideIsTreatedAsAbsent() {
        var a = msg(Map.of());
        var result = useCase.bulkReplay(CONFIG_ID, List.of(a.getId()), USER_ID, "  ");
        assertThat(result.failed()).isEqualTo(1);
        verifyNoInteractions(producer);
    }

    private void inject(String field, Object value) {
        try {
            var f = BulkReplayUseCase.class.getDeclaredField(field);
            f.setAccessible(true);
            f.set(useCase, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
