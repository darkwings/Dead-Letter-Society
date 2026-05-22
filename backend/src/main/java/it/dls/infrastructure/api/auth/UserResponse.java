package it.dls.infrastructure.api.auth;

import it.dls.domain.user.User;

public record UserResponse(String id, String email, String displayName, String role) {

    public static UserResponse from(User u) {
        return new UserResponse(
            u.getId().toString(),
            u.getEmail(),
            u.getDisplayName(),
            u.getGlobalRole().name()
        );
    }
}
