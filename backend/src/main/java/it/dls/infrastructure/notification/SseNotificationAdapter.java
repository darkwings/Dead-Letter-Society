package it.dls.infrastructure.notification;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import it.dls.domain.shared.NotificationPort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class SseNotificationAdapter implements NotificationPort {

    private final BroadcastProcessor<SseEvent> processor = BroadcastProcessor.create();

    public Multi<String> streamForUser(Set<UUID> accessibleConfigIds) {
        Multi<SseEvent> source = accessibleConfigIds == null
            ? processor
            : processor.filter(e -> accessibleConfigIds.contains(e.dlqConfigId()));
        return source.map(SseEvent::toJson);
    }

    @Override
    public void emitFetchCompleted(UUID dlqConfigId, int messageCount) {
        processor.onNext(SseEvent.fetchCompleted(dlqConfigId, messageCount));
    }

    @Override
    public void emitFetchFailed(UUID dlqConfigId, String errorMessage) {
        processor.onNext(SseEvent.fetchFailed(dlqConfigId, errorMessage));
    }

    @Override
    public void emitNoteAdded(UUID messageId, UUID dlqConfigId) {
        processor.onNext(SseEvent.noteAdded(messageId, dlqConfigId));
    }

    @Override
    public void emitMessageStatusChanged(UUID messageId, UUID dlqConfigId, String newStatus) {
        processor.onNext(SseEvent.messageStatusChanged(messageId, dlqConfigId, newStatus));
    }
}
