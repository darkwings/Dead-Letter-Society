package it.dls.infrastructure.api.dashboard;

import it.dls.application.dashboard.DashboardUseCase;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/dashboard")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class DashboardResource {

    @Inject
    DashboardUseCase dashboard;

    @GET
    @Path("/summary")
    public Response getSummary() {
        return Response.ok(dashboard.getSummary()).build();
    }

    @GET
    @Path("/sparkline")
    public Response getSparkline(@QueryParam("days") @DefaultValue("7") int days) {
        if (days < 1 || days > 90) days = 7;
        return Response.ok(dashboard.getSparkline(days)).build();
    }
}
