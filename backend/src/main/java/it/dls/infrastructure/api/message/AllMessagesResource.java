package it.dls.infrastructure.api.message;

import it.dls.application.inspection.FailureInfoAssembler;
import it.dls.application.inspection.InspectMessagesUseCase;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.Pageable;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/api/messages")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class AllMessagesResource {

    @Inject InspectMessagesUseCase inspectMessages;
    @Inject FailureInfoAssembler failureInfoAssembler;
    @Inject JsonWebToken jwt;

    @GET
    public Response listAllMessages(
            @QueryParam("status") String statusParam,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("50") int size) {
        try {
            MessageStatus status = statusParam != null ? MessageStatus.valueOf(statusParam) : null;
            var result = inspectMessages.listAllMessages(
                status, new Pageable(page, size), currentUserId(), isAdmin());
            return Response.ok(MessagePageResponse.from(result, failureInfoAssembler.assembleAll(result.messages()))).build();
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity(e.getMessage()).build();
        }
    }

    private UUID currentUserId() {
        return UUID.fromString(jwt.getSubject());
    }

    private boolean isAdmin() {
        return jwt.getGroups().contains("ADMIN");
    }
}
