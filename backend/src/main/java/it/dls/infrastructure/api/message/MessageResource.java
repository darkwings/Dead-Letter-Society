package it.dls.infrastructure.api.message;

import it.dls.application.inspection.InspectMessagesUseCase;
import it.dls.domain.message.MessageStatus;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/api/messages/{messageId}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class MessageResource {

    @Inject InspectMessagesUseCase inspectMessages;
    @Inject JsonWebToken jwt;

    @GET
    public Response getMessage(@PathParam("messageId") UUID messageId) {
        try {
            var msg = inspectMessages.getMessage(messageId, currentUserId(), isAdmin());
            return Response.ok(MessageResponse.from(msg)).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage())).build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                .entity(new ErrorResponse("FORBIDDEN", e.getMessage())).build();
        }
    }

    @PUT
    @Path("/status")
    public Response updateStatus(@PathParam("messageId") UUID messageId, UpdateStatusRequest req) {
        if (req == null || req.status() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "status is required")).build();
        }
        MessageStatus newStatus;
        try {
            newStatus = MessageStatus.valueOf(req.status());
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_STATUS", "Unknown status: " + req.status())).build();
        }
        if (newStatus != MessageStatus.UNDER_REVIEW && newStatus != MessageStatus.DISCARDED) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_STATUS", "Only UNDER_REVIEW and DISCARDED allowed")).build();
        }
        try {
            var updated = inspectMessages.updateStatus(messageId, newStatus, currentUserId(), isAdmin());
            return Response.ok(MessageResponse.from(updated)).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage())).build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                .entity(new ErrorResponse("FORBIDDEN", e.getMessage())).build();
        }
    }

    private UUID currentUserId() {
        return UUID.fromString(jwt.getSubject());
    }

    private boolean isAdmin() {
        return jwt.getGroups().contains("ADMIN");
    }
}
