package it.dls.infrastructure.api.replay;

import it.dls.application.replay.ReplayMessageUseCase;
import it.dls.application.replay.ReplayTopicNotResolvableException;
import it.dls.application.replay.SchemaValidationException;
import it.dls.infrastructure.api.ProblemDetail;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/api/messages/{id}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class ReplayResource {

    @Inject ReplayMessageUseCase replayUseCase;
    @Inject JsonWebToken jwt;

    @POST
    @Path("/replay")
    public Response replay(@PathParam("id") UUID messageId, ReplayRequest req) {
        try {
            var body = req != null ? req : new ReplayRequest(null, null);
            var result = replayUseCase.replay(messageId, body.targetTopicOverride(),
                body.editedPayload(), currentUserId());
            return result.success()
                ? Response.ok(result).build()
                : Response.status(422).entity(result).build();
        } catch (ReplayTopicNotResolvableException e) {
            return ProblemDetail.badRequest(e.getMessage()).toResponse();
        } catch (SchemaValidationException e) {
            return ProblemDetail.unprocessable(e.getMessage()).toResponse();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }

    @POST
    @Path("/validate-payload")
    public Response validatePayload(@PathParam("id") UUID messageId, ValidatePayloadRequest req) {
        if (req == null || req.payload() == null) {
            return ProblemDetail.badRequest("payload is required").toResponse();
        }
        try {
            var result = replayUseCase.validatePayload(messageId, req.payload());
            return Response.ok(new ValidatePayloadResponse(result.valid(), result.error())).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }

    private UUID currentUserId() {
        return UUID.fromString(jwt.getSubject());
    }
}
