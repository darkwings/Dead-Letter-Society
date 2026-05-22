package it.dls.domain.shared;

import java.util.UUID;

public interface NotificationPort {
    void emitFetchCompleted(UUID dlqConfigId, int messageCount);
    void emitFetchFailed(UUID dlqConfigId, String errorMessage);
    void emitNoteAdded(UUID messageId, UUID dlqConfigId);
    void emitMessageStatusChanged(UUID messageId, UUID dlqConfigId, String newStatus);
}
