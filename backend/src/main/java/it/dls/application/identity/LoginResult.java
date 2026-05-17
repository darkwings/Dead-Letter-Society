package it.dls.application.identity;

import it.dls.domain.user.User;

public final class LoginResult {
    private final User user;
    private final LoginFailure failure;

    private LoginResult(User user, LoginFailure failure) {
        this.user = user;
        this.failure = failure;
    }

    public static LoginResult success(User user) {
        return new LoginResult(user, null);
    }

    public static LoginResult failure(LoginFailure reason) {
        return new LoginResult(null, reason);
    }

    public boolean isSuccess() { return user != null; }
    public boolean isFailure() { return failure != null; }
    public User getUser() { return user; }
    public LoginFailure failureReason() { return failure; }
}
