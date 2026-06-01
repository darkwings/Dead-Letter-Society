package it.dls.application.identity;

import it.dls.domain.user.AuthProvider;
import it.dls.domain.user.UserRepository;

import java.util.UUID;

public class ChangePasswordUseCase {

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public ChangePasswordUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    public void changeSelf(UUID userId, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 8)
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (user.getAuthProvider() == AuthProvider.OIDC)
            throw new IllegalStateException("cannot-change-password-for-oidc-user");
        if (!passwordHash.verify(currentPassword, user.getPasswordHash()))
            throw new SecurityException("invalid-current-password");
        user.changePassword(passwordHash.hash(newPassword));
        userRepository.save(user);
    }

    public void adminReset(UUID targetUserId, String newPassword) {
        if (newPassword == null || newPassword.length() < 8)
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        var user = userRepository.findById(targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + targetUserId));
        if (user.getAuthProvider() == AuthProvider.OIDC)
            throw new IllegalStateException("cannot-reset-oidc-user");
        user.changePassword(passwordHash.hash(newPassword));
        userRepository.save(user);
    }
}
