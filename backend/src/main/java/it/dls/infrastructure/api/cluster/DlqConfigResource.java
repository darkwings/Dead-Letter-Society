package it.dls.infrastructure.api.cluster;

import it.dls.application.cluster.ManageDlqConfigUseCase;
import it.dls.infrastructure.api.auth.ErrorResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.UUID;

@Path("/api/dlq-configs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class DlqConfigResource {

    @Inject
    ManageDlqConfigUseCase manageDlqConfig;

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
