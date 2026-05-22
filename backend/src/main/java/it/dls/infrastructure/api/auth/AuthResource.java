package it.dls.infrastructure.api.auth;

import io.smallrye.jwt.build.Jwt;
import it.dls.application.identity.LoginFailure;
import it.dls.application.identity.LoginUseCase;
import it.dls.application.identity.RegisterAdminUseCase;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    @Inject LoginUseCase loginUseCase;
    @Inject RegisterAdminUseCase registerAdmin;
    @Inject UserRepository userRepository;
    @Inject JsonWebToken jwt;

    @POST
    @Path("/login")
    @PermitAll
    public Response login(LoginRequest req) {
        if (req == null || req.email() == null || req.email().isBlank()
                || req.password() == null || req.password().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("INVALID_REQUEST", "email and password are required"))
                    .build();
        }
        var result = loginUseCase.login(req.email(), req.password());
        if (result.isFailure()) {
            var status = result.failureReason() == LoginFailure.ACCOUNT_LOCKED
                ? Response.Status.FORBIDDEN
                : Response.Status.UNAUTHORIZED;
            return Response.status(status)
                .entity(new ErrorResponse(result.failureReason().name(), result.failureReason().name()))
                .build();
        }
        User user = result.getUser();
        String token = Jwt.issuer("https://dls.io")
            .subject(user.getId().toString())
            .groups(Set.of(user.getGlobalRole().name()))
            .claim("email", user.getEmail())
            .claim("displayName", user.getDisplayName())
            .expiresIn(Duration.ofHours(8))
            .sign();
        return Response.ok(new LoginResponse(token, UserResponse.from(user))).build();
    }

    @GET
    @Path("/me")
    @RolesAllowed({"ADMIN", "USER"})
    public Response me() {
        UUID id = UUID.fromString(jwt.getSubject());
        return userRepository.findById(id)
                .map(u -> Response.ok(UserResponse.from(u)).build())
                .orElse(Response.status(Response.Status.UNAUTHORIZED).build());
    }

    @GET
    @Path("/users")
    @RolesAllowed("ADMIN")
    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream()
            .map(UserResponse::from)
            .toList();
    }

    @POST
    @Path("/users")
    @RolesAllowed("ADMIN")
    @Transactional
    public Response createUser(CreateAdminRequest req) {
        if (req == null || req.email() == null || req.email().isBlank()
                || req.displayName() == null || req.displayName().isBlank()
                || req.password() == null || req.password().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("INVALID_REQUEST", "email, displayName and password are required"))
                .build();
        }
        try {
            var user = registerAdmin.createUser(req.email(), req.displayName(), req.password());
            return Response.status(Response.Status.CREATED).entity(UserResponse.from(user)).build();
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT)
                .entity(new ErrorResponse("DUPLICATE_EMAIL", e.getMessage()))
                .build();
        }
    }
}
