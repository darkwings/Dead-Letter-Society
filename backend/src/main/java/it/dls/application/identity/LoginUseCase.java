package it.dls.application.identity;

import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;

import java.util.Optional;

public class LoginUseCase {

    private static final String DUMMY_HASH = "$2a$12$DummyHashToPreventTimingOracleXX.XXXXXXXXXXXXXXXXXXX";

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public LoginUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    public LoginResult login(String email, String password) {
        Optional<User> maybeUser = userRepository.findByEmail(email);
        if (maybeUser.isEmpty()) {
            passwordHash.verify(password, DUMMY_HASH);
            return LoginResult.failure(LoginFailure.INVALID_CREDENTIALS);
        }

        User user = maybeUser.get();
        if (user.isLocked()) return LoginResult.failure(LoginFailure.ACCOUNT_LOCKED);

        if (!passwordHash.verify(password, user.getPasswordHash())) {
            user.recordFailedLoginAttempt();
            userRepository.save(user);
            return LoginResult.failure(LoginFailure.INVALID_CREDENTIALS);
        }

        user.resetFailedAttempts();
        userRepository.save(user);
        return LoginResult.success(user);
    }
}
