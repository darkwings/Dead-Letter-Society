package it.dls.infrastructure.api.cluster;

import it.dls.application.cluster.ManageDlqConfigUseCase;
import it.dls.application.fetch.FetchAlreadyInProgressException;
import it.dls.application.fetch.FetchMessagesUseCase;
import it.dls.infrastructure.api.ProblemDetail;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/dlq-configs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class DlqConfigResource {

    @Inject ManageDlqConfigUseCase manageDlqConfig;
    @Inject FetchMessagesUseCase fetchMessages;
    @Inject JsonWebToken jwt;

    @GET
    @Path("/my")
    public List<DlqConfigResponse> listForCurrentUser() {
        UUID userId = UUID.fromString(jwt.getSubject());
        return manageDlqConfig.listForUser(userId).stream()
            .map(DlqConfigResponse::from)
            .toList();
    }

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") UUID id) {
        return manageDlqConfig.findById(id)
            .map(c -> Response.ok(DlqConfigResponse.from(c)).build())
            .orElseGet(() -> ProblemDetail.notFound("DlqConfig not found: " + id).toResponse());
    }

    @POST
    @Path("/{id}/fetch")
    public Response fetchNow(@PathParam("id") UUID id) {
        try {
            var result = fetchMessages.fetchOnDemand(id, UUID.fromString(jwt.getSubject()));
            return Response.ok(Map.of("fetched", result.count())).build();
        } catch (FetchAlreadyInProgressException e) {
            return ProblemDetail.conflict("A fetch is already in progress for this config").toResponse();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (Exception e) {
            return ProblemDetail.internalError(e.getMessage()).toResponse();
        }
    }

    @PUT
    @Path("/{id}/users")
    @RolesAllowed("ADMIN")
    public Response assignUser(@PathParam("id") UUID id, AssignUserRequest req) {
        if (req == null || req.userId() == null || req.role() == null) {
            return ProblemDetail.badRequest("userId and role are required").toResponse();
        }
        try {
            manageDlqConfig.assignUser(id, req.userId(), req.role());
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }

    @DELETE
    @Path("/{id}/users/{userId}")
    @RolesAllowed("ADMIN")
    public Response revokeUser(@PathParam("id") UUID id, @PathParam("userId") UUID userId) {
        try {
            manageDlqConfig.revokeUser(id, userId);
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        }
    }
}
