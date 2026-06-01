package it.dls.application.inspection;

import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.*;
import it.dls.domain.shared.NotificationPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * INSP-001: VIEWER can explicitly set UNDER_REVIEW.
 * INSP-002: VIEWER cannot set DISCARDED — SecurityException.
 * INSP-003: OPERATOR can set any allowed status.
 * INSP-004: Unassigned user cannot set UNDER_REVIEW — SecurityException.
 * INSP-005: VIEWER can bulkMarkUnderReview.
 * INSP-006: Unassigned user cannot bulkMarkUnderReview — SecurityException.
 */
class InspectMessagesUseCaseTest {

    MessageRepository messageRepo = mock(MessageRepository.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    InspectMessagesUseCase useCase;

    UUID dlqConfigId = UUID.randomUUID();
    UUID viewerUserId = UUID.randomUUID();
    UUID operatorUserId = UUID.randomUUID();
    UUID outsiderUserId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new InspectMessagesUseCase();
        useCase.messageRepo = messageRepo;
        useCase.configRepo = configRepo;
        useCase.notifier = notifier;

        var config = DlqConfig.reconstitute(dlqConfigId, UUID.randomUUID(), "topic", "DLQ",
            null, null, null,
            List.of(
                new UserAssignment(viewerUserId, DlqRole.VIEWER),
                new UserAssignment(operatorUserId, DlqRole.OPERATOR)
            ),
            List.of());
        when(configRepo.findById(dlqConfigId)).thenReturn(Optional.of(config));
    }

    // INSP-001
    @Test
    void viewer_can_set_UNDER_REVIEW() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));

        var result = useCase.updateStatus(msgId, MessageStatus.UNDER_REVIEW, viewerUserId, false);

        assertThat(result.getStatus()).isEqualTo(MessageStatus.UNDER_REVIEW);
        verify(messageRepo).save(msg);
    }

    // INSP-002
    @Test
    void viewer_cannot_set_DISCARDED() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));

        assertThatThrownBy(() -> useCase.updateStatus(msgId, MessageStatus.DISCARDED, viewerUserId, false))
            .isInstanceOf(SecurityException.class);
        verify(messageRepo, never()).save(any());
    }

    // INSP-003
    @Test
    void operator_can_set_DISCARDED() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));

        var result = useCase.updateStatus(msgId, MessageStatus.DISCARDED, operatorUserId, false);

        assertThat(result.getStatus()).isEqualTo(MessageStatus.DISCARDED);
    }

    // INSP-004
    @Test
    void unassigned_user_cannot_set_UNDER_REVIEW() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));

        assertThatThrownBy(() -> useCase.updateStatus(msgId, MessageStatus.UNDER_REVIEW, outsiderUserId, false))
            .isInstanceOf(SecurityException.class);
    }

    // INSP-005
    @Test
    void viewer_can_bulk_mark_under_review() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));

        var result = useCase.bulkMarkUnderReview(dlqConfigId, List.of(msgId), viewerUserId, false);

        assertThat(result.succeeded()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.UNDER_REVIEW);
    }

    // INSP-006
    @Test
    void unassigned_user_cannot_bulk_mark_under_review() {
        var msgId = UUID.randomUUID();

        assertThatThrownBy(() -> useCase.bulkMarkUnderReview(dlqConfigId, List.of(msgId), outsiderUserId, false))
            .isInstanceOf(SecurityException.class);
    }

    private DlqMessage message(UUID id, UUID configId, MessageStatus status) {
        return DlqMessage.reconstitute(id, configId, 0, 0L, Instant.now(),
            new byte[]{}, new byte[]{1}, null, null, null, status, false, Instant.now(),
            null, null);
    }
}
