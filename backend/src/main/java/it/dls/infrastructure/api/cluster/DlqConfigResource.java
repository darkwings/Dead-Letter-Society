package it.dls.infrastructure.api.cluster;

import it.dls.application.cluster.ManageDlqConfigUseCase;
import it.dls.application.fetch.FetchAlreadyInProgressException;
import it.dls.application.fetch.FetchMessagesUseCase;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Map;
import java.util.UUID;

@Path("/api/dlq-configs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class DlqConfigResource {

    @Inject ManageDlqConfigUseCase manageDlqConfig;
    @Inject FetchMessagesUseCase fetchMessages;
    @Inject JsonWebToken jwt;

    @POST
    @Path("/{id}/fetch")
    @RolesAllowed({"ADMIN", "USER"})
    public Response fetchNow(@PathParam("id") UUID id) {
        try {
            var result = fetchMessages.fetchOnDemand(id, UUID.fromString(jwt.getSubject()));
            return Response.ok(Map.of("fetched", result.count())).build();
        } catch (FetchAlreadyInProgressException e) {
            return Response.status(Response.Status.CONFLICT)
                .entity(new ErrorResponse("FETCH_IN_PROGRESS", "A fetch is already in progress for this config"))
                .build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage()))
                .build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorResponse("FETCH_ERROR", e.getMessage()))
                .build();
        }
    }

    @PUT
    @Path("/{id}/users")
    public Response assignUser(@PathParam("id") UUID id, AssignUserRequest req) {
        if (req == null || req.userId() == null || req.role() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "userId and role are required"))
                .build();
        }
        try {
            manageDlqConfig.assignUser(id, req.userId(), req.role());
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("NOT_FOUND", e.getMessage()))
                .build();
        }
    }
}
