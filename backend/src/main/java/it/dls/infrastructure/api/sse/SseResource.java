package it.dls.infrastructure.api.sse;

import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import it.dls.infrastructure.notification.SseNotificationAdapter;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Path("/api/events")
@RolesAllowed({"ADMIN", "USER"})
public class SseResource {

    @Inject
    SseNotificationAdapter notifications;

    @Inject
    JsonWebToken jwt;

    @Inject
    EntityManager em;

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.TEXT_PLAIN)
    @Blocking
    public Multi<String> stream() {
        if (jwt.getGroups().contains("ADMIN")) {
            return notifications.streamForUser(null);
        }
        UUID userId = UUID.fromString(jwt.getSubject());
        Set<UUID> accessible = em.createQuery(
                "select a.dlqConfig.id from DlqUserAssignmentEntity a where a.userId = :uid",
                UUID.class)
            .setParameter("uid", userId)
            .getResultStream()
            .collect(Collectors.toSet());
        return notifications.streamForUser(accessible);
    }
}
