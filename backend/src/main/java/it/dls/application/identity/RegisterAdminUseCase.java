package it.dls.application.identity;

import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;

public class RegisterAdminUseCase {

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public RegisterAdminUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    /**
     * Registers the first administrator account.
     * MUST be called within a transaction: the existsAny() check and save() are not atomic otherwise.
     */
    public User registerFirstAdmin(String email, String displayName, String password) {
        if (userRepository.existsAny()) {
            throw new IllegalStateException("Setup already completed. First admin already exists.");
        }
        var user = User.createLocal(email, displayName, passwordHash.hash(password));
        user.promoteToAdmin();
        userRepository.save(user);
        return user;
    }
}
