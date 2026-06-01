package it.dls.infrastructure.api.auth;

import io.smallrye.jwt.build.Jwt;
import it.dls.application.identity.ChangePasswordUseCase;
import it.dls.application.identity.LoginFailure;
import it.dls.application.identity.LoginUseCase;
import it.dls.application.identity.RegisterAdminUseCase;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import it.dls.infrastructure.api.ProblemDetail;
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
    @Inject ChangePasswordUseCase changePassword;

    @POST
    @Path("/login")
    @PermitAll
    public Response login(LoginRequest req) {
        if (req == null || req.email() == null || req.email().isBlank()
                || req.password() == null || req.password().isBlank()) {
            return ProblemDetail.badRequest("email and password are required").toResponse();
        }
        var result = loginUseCase.login(req.email(), req.password());
        if (result.isFailure()) {
            var status = result.failureReason() == LoginFailure.ACCOUNT_LOCKED ? 403 : 401;
            return ProblemDetail.of(status,
                result.failureReason().name().toLowerCase().replace('_', '-'),
                result.failureReason().name(),
                result.failureReason().name()).toResponse();
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
                .orElse(ProblemDetail.unauthorized("User not found").toResponse());
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
            return ProblemDetail.badRequest("email, displayName and password are required").toResponse();
        }
        try {
            var user = registerAdmin.createUser(req.email(), req.displayName(), req.password());
            return Response.status(Response.Status.CREATED).entity(UserResponse.from(user)).build();
        } catch (IllegalStateException e) {
            return ProblemDetail.conflict(e.getMessage()).toResponse();
        }
    }

    @PATCH
    @Path("/users/me/password")
    @RolesAllowed({"ADMIN", "USER"})
    public Response changeMyPassword(ChangeMyPasswordRequest req) {
        if (req == null || req.currentPassword() == null || req.currentPassword().isBlank()
                || req.newPassword() == null || req.newPassword().isBlank()) {
            return ProblemDetail.badRequest("currentPassword and newPassword are required").toResponse();
        }
        UUID userId = UUID.fromString(jwt.getSubject());
        try {
            changePassword.changeSelf(userId, req.currentPassword(), req.newPassword());
            return Response.noContent().build();
        } catch (SecurityException e) {
            return ProblemDetail.unauthorized(e.getMessage()).toResponse();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.badRequest(e.getMessage()).toResponse();
        }
    }

    @PATCH
    @Path("/users/{id}/password")
    @RolesAllowed("ADMIN")
    public Response resetUserPassword(@PathParam("id") UUID targetId, ResetUserPasswordRequest req) {
        if (req == null || req.newPassword() == null || req.newPassword().isBlank()) {
            return ProblemDetail.badRequest("newPassword is required").toResponse();
        }
        try {
            changePassword.adminReset(targetId, req.newPassword());
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return ProblemDetail.notFound(e.getMessage()).toResponse();
        } catch (IllegalStateException e) {
            return ProblemDetail.unprocessable(e.getMessage()).toResponse();
        }
    }
}
