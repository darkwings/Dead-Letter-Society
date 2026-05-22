package it.dls.application.inspection;

import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.DlqRole;
import it.dls.domain.message.*;
import it.dls.domain.shared.NotificationPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.UUID;

@ApplicationScoped
public class InspectMessagesUseCase {

    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject NotificationPort notifier;

    @Transactional(Transactional.TxType.SUPPORTS)
    public MessagePage listMessages(UUID dlqConfigId, MessageFilter filter, Pageable pageable,
                                    UUID requestingUserId, boolean isAdmin) {
        if (!isAdmin) assertReadAccess(dlqConfigId, requestingUserId);
        return messageRepo.findByConfig(dlqConfigId, filter, pageable);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public DlqMessage getMessage(UUID messageId, UUID requestingUserId, boolean isAdmin) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        if (!isAdmin) assertReadAccess(msg.getDlqConfigId(), requestingUserId);
        return msg;
    }

    @Transactional
    public DlqMessage updateStatus(UUID messageId, MessageStatus newStatus,
                                   UUID requestingUserId, boolean isAdmin) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        if (!isAdmin) assertOperatorAccess(msg.getDlqConfigId(), requestingUserId);
        msg.transitionTo(newStatus);
        messageRepo.save(msg);
        notifier.emitMessageStatusChanged(messageId, msg.getDlqConfigId(), newStatus.name());
        return msg;
    }

    private void assertReadAccess(UUID dlqConfigId, UUID userId) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        boolean assigned = config.getUserAssignments().stream()
            .anyMatch(a -> a.userId().equals(userId));
        if (!assigned) throw new SecurityException("Access denied to DlqConfig " + dlqConfigId);
    }

    private void assertOperatorAccess(UUID dlqConfigId, UUID userId) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        boolean isOperator = config.getUserAssignments().stream()
            .anyMatch(a -> a.userId().equals(userId) && a.role() == DlqRole.OPERATOR);
        if (!isOperator) throw new SecurityException("OPERATOR role required for DlqConfig " + dlqConfigId);
    }
}
