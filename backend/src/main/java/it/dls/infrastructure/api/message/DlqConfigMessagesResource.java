package it.dls.infrastructure.api.message;

import it.dls.application.inspection.FailureInfoAssembler;
import it.dls.application.inspection.InspectMessagesUseCase;
import it.dls.application.inspection.BulkDiscardResult;
import it.dls.application.inspection.BulkUnderReviewResult;
import it.dls.application.replay.BulkReplayUseCase;
import it.dls.domain.message.MessageFilter;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.Pageable;
import it.dls.infrastructure.api.ProblemDetail;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/dlq-configs/{configId}/messages")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class DlqConfigMessagesResource {

    @Inject InspectMessagesUseCase inspectMessages;
    @Inject FailureInfoAssembler failureInfoAssembler;
    @Inject BulkReplayUseCase bulkReplay;
    @Inject JsonWebToken jwt;

    @GET
    public Response listMessages(
            @PathParam("configId") UUID configId,
            @QueryParam("status") String statusParam,
            @QueryParam("from") String fromParam,
            @QueryParam("to") String toParam,
            @QueryParam("partition") Integer partition,
            @QueryParam("offsetFrom") Long offsetFrom,
            @QueryParam("offsetTo") Long offsetTo,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        try {
            MessageStatus status = statusParam != null ? MessageStatus.valueOf(statusParam) : null;
            Instant from = fromParam != null ? Instant.parse(fromParam) : null;
            Instant to = toParam != null ? Instant.parse(toParam) : null;
            var filter = new MessageFilter(status, from, to, partition, offsetFrom, offsetTo);
            var result = inspectMessages.listMessages(
                configId, filter, new Pageable(page, size), currentUserId(), isAdmin());
            return Response.ok(MessagePageResponse.from(result, failureInfoAssembler.assembleAll(result.messages()))).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (SecurityException e) {
            return ProblemDetail.forbidden(e.getMessage()).toResponse();
        } catch (Exception e) {
            return ProblemDetail.badRequest(e.getMessage()).toResponse();
        }
    }

    @POST
    @Path("/bulk-replay")
    @RolesAllowed({"ADMIN", "OPERATOR"})
    public Response bulkReplay(@PathParam("configId") UUID configId, BulkReplayRequest req) {
        if (req == null || req.messageIds() == null || req.messageIds().isEmpty()) {
            return ProblemDetail.badRequest("messageIds must not be empty").toResponse();
        }
        try {
            var result = bulkReplay.bulkReplay(configId, req.messageIds(), currentUserId(), req.targetTopicOverride());
            return Response.ok(result).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (SecurityException e) {
            return ProblemDetail.forbidden(e.getMessage()).toResponse();
        }
    }

    @POST
    @Path("/bulk-discard")
    @RolesAllowed({"ADMIN", "OPERATOR"})
    public Response bulkDiscard(@PathParam("configId") UUID configId, BulkReplayRequest req) {
        if (req == null || req.messageIds() == null || req.messageIds().isEmpty()) {
            return ProblemDetail.badRequest("messageIds must not be empty").toResponse();
        }
        try {
            BulkDiscardResult result = inspectMessages.bulkDiscard(configId, req.messageIds(),
                currentUserId(), isAdmin());
            return Response.ok(result).build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (SecurityException e) {
            return ProblemDetail.forbidden(e.getMessage()).toResponse();
        }
    }

    @POST
    @Path("/bulk-under-review")
    @RolesAllowed({"ADMIN", "OPERATOR"})
    public Response bulkMarkUnderReview(@PathParam("configId") UUID configId, BulkReplayRequest req) {
        if (req == null || req.messageIds() == null || req.messageIds().isEmpty()) {
            return ProblemDetail.badRequest("messageIds must not be empty").toResponse();
        }
        try {
            BulkUnderReviewResult result = inspectMessages.bulkMarkUnderReview(configId, req.messageIds(),
                currentUserId(), isAdmin());
            return Response.ok(result).build();
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
