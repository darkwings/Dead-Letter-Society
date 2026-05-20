package it.dls.infrastructure.notification;

import it.dls.domain.shared.NotificationPort;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.UUID;

@ApplicationScoped
public class NoOpNotificationAdapter implements NotificationPort {

    private static final Logger log = Logger.getLogger(NoOpNotificationAdapter.class);

    @Override
    public void emitFetchCompleted(UUID dlqConfigId, int messageCount) {
        log.debugf("SSE fetch completed: dlqConfigId=%s count=%d", dlqConfigId, messageCount);
    }

    @Override
    public void emitFetchFailed(UUID dlqConfigId, String errorMessage) {
        log.warnf("SSE fetch failed: dlqConfigId=%s error=%s", dlqConfigId, errorMessage);
    }
}
