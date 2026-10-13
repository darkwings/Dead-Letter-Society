package it.dls.infrastructure.api.message;

import it.dls.application.inspection.FailureInfoAssembler;
import it.dls.application.inspection.InspectMessagesUseCase;
import it.dls.domain.message.MessageStatus;
import it.dls.infrastructure.api.ProblemDetail;
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
    @Inject FailureInfoAssembler failureInfoAssembler;
    @Inject JsonWebToken jwt;

    @GET
    public Response getMessage(@PathParam("messageId") UUID messageId) {
        try {
            var msg = inspectMessages.getMessage(messageId, currentUserId(), isAdmin());
            return Response.ok(MessageResponse.from(msg, failureInfoAssembler.assembleAll(java.util.List.of(msg)).get(msg.getId()))).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (SecurityException e) {
            return ProblemDetail.forbidden(e.getMessage()).toResponse();
        }
    }

    @PUT
    @Path("/status")
    public Response updateStatus(@PathParam("messageId") UUID messageId, UpdateStatusRequest req) {
        if (req == null || req.status() == null) {
            return ProblemDetail.badRequest("status is required").toResponse();
        }
        MessageStatus newStatus;
        try {
            newStatus = MessageStatus.valueOf(req.status());
        } catch (IllegalArgumentException e) {
            return ProblemDetail.badRequest("Unknown status: " + req.status()).toResponse();
        }
        if (newStatus != MessageStatus.UNDER_REVIEW && newStatus != MessageStatus.DISCARDED) {
            return ProblemDetail.badRequest("Only UNDER_REVIEW and DISCARDED allowed").toResponse();
        }
        try {
            var updated = inspectMessages.updateStatus(messageId, newStatus, currentUserId(), isAdmin());
            return Response.ok(MessageResponse.from(updated, failureInfoAssembler.assembleAll(java.util.List.of(updated)).get(updated.getId()))).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (SecurityException e) {
            return ProblemDetail.forbidden(e.getMessage()).toResponse();
        }
    }

    private UUID currentUserId() {
        return UUID.fromString(jwt.getSubject());
    }

    private boolean isAdmin() {
        return jwt.getGroups().contains("ADMIN");
    }
}
