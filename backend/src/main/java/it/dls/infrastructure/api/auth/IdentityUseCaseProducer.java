package it.dls.infrastructure.api.auth;

import it.dls.application.identity.ChangePasswordUseCase;
import it.dls.application.identity.LoginUseCase;
import it.dls.application.identity.OidcLoginUseCase;
import it.dls.application.identity.PasswordHashPort;
import it.dls.application.identity.RegisterAdminUseCase;
import it.dls.domain.user.UserRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class IdentityUseCaseProducer {

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHashPort passwordHashPort;

    @ConfigProperty(name = "dls.oidc.admin-claim-name", defaultValue = "roles")
    String adminClaimName;

    @ConfigProperty(name = "dls.oidc.admin-claim-value", defaultValue = "dls-admin")
    String adminClaimValue;

    @Produces
    @ApplicationScoped
    public LoginUseCase loginUseCase() {
        return new LoginUseCase(userRepository, passwordHashPort);
    }

    @Produces
    @ApplicationScoped
    public RegisterAdminUseCase registerAdminUseCase() {
        return new RegisterAdminUseCase(userRepository, passwordHashPort);
    }

    @Produces
    @ApplicationScoped
    public OidcLoginUseCase oidcLoginUseCase() {
        return new OidcLoginUseCase(userRepository, adminClaimName, adminClaimValue);
    }

    @Produces
    @ApplicationScoped
    public ChangePasswordUseCase changePasswordUseCase() {
        return new ChangePasswordUseCase(userRepository, passwordHashPort);
    }
}
