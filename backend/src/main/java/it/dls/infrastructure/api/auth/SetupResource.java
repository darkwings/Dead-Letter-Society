package it.dls.infrastructure.api.auth;

import it.dls.application.identity.RegisterAdminUseCase;
import it.dls.domain.user.UserRepository;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/setup")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SetupResource {

    @Inject
    RegisterAdminUseCase registerAdmin;

    @Inject
    UserRepository userRepository;

    @GET
    @Path("/status")
    public SetupStatusResponse status() {
        return new SetupStatusResponse(!userRepository.existsAny());
    }

    @POST
    @Transactional
    public Response createAdmin(CreateAdminRequest req) {
        if (userRepository.existsAny()) {
            return Response.status(Response.Status.CONFLICT)
                .entity(new ErrorResponse("SETUP_ALREADY_DONE", "Setup already completed"))
                .build();
        }
        var user = registerAdmin.registerFirstAdmin(req.email(), req.displayName(), req.password());
        return Response.status(Response.Status.CREATED)
            .entity(UserResponse.from(user))
            .build();
    }
}
