package it.dls.infrastructure.api.auth;

import it.dls.application.identity.LoginUseCase;
import it.dls.application.identity.PasswordHashPort;
import it.dls.application.identity.RegisterAdminUseCase;
import it.dls.domain.user.UserRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

@ApplicationScoped
public class IdentityUseCaseProducer {

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHashPort passwordHashPort;

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
}
