package it.dls.infrastructure.api.auth;

import io.quarkus.security.Authenticated;
import io.smallrye.jwt.build.Jwt;
import it.dls.application.identity.OidcLoginUseCase;
import it.dls.domain.user.User;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.time.Duration;
import java.util.Set;

@Path("/api/auth/oidc")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class OidcCallbackResource {

    @Inject
    OidcLoginUseCase oidcLoginUseCase;

    @Inject
    JsonWebToken oidcToken;

    @POST
    @Path("/exchange")
    @Authenticated
    @Transactional
    public Response exchange() {
        String subject = oidcToken.getSubject();
        String email = oidcToken.getClaim("email");
        String displayName = oidcToken.<String>getClaim("name") != null
            ? oidcToken.<String>getClaim("name")
            : email;

        JsonObject claims = buildClaimsObject();
        User user = oidcLoginUseCase.loginOrProvision(subject, email, displayName, claims);

        String token = Jwt.issuer("https://dls.io")
            .subject(user.getId().toString())
            .groups(Set.of(user.getGlobalRole().name()))
            .claim("email", user.getEmail())
            .claim("displayName", user.getDisplayName())
            .expiresIn(Duration.ofHours(8))
            .sign();

        return Response.ok(new LoginResponse(token, UserResponse.from(user))).build();
    }

    private JsonObject buildClaimsObject() {
        var builder = Json.createObjectBuilder();
        oidcToken.getClaimNames().forEach(name -> {
            Object value = oidcToken.getClaim(name);
            if (value instanceof java.util.Collection<?> col) {
                var arrBuilder = Json.createArrayBuilder();
                col.forEach(item -> arrBuilder.add(item.toString()));
                builder.add(name, arrBuilder.build());
            } else if (value != null) {
                builder.add(name, value.toString());
            }
        });
        return builder.build();
    }
}
