package it.dls.domain.user;

import java.util.UUID;


public class User {
    private static final int MAX_FAILED_ATTEMPTS = 5;

    private final UUID id;
    private final String email;
    private String displayName;
    private final AuthProvider authProvider;
    private GlobalRole globalRole;
    private String passwordHash;
    private String oidcSubject;
    private int failedLoginAttempts;
    private boolean locked;

    private User(UUID id, String email, String displayName,
                 AuthProvider provider, String passwordHash, String oidcSubject) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("email must not be blank");
        if (displayName == null || displayName.isBlank()) throw new IllegalArgumentException("displayName must not be blank");
        this.id = id;
        this.email = email;
        this.displayName = displayName;
        this.authProvider = provider;
        this.globalRole = GlobalRole.USER;
        this.passwordHash = passwordHash;
        this.oidcSubject = oidcSubject;
    }

    public static User createLocal(String email, String displayName, String passwordHash) {
        if (passwordHash == null || passwordHash.isBlank()) throw new IllegalArgumentException("passwordHash must not be blank");
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.LOCAL, passwordHash, null);
    }

    public static User createOidc(String email, String displayName, String subject) {
        if (subject == null || subject.isBlank()) throw new IllegalArgumentException("oidcSubject must not be blank");
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.OIDC, null, subject);
    }

    /** Reconstitutes a User from persistence — bypasses business logic side effects. */
    public static User reconstitute(UUID id, String email, String displayName,
                                     String passwordHash, String oidcSubject,
                                     AuthProvider authProvider,
                                     GlobalRole globalRole, int failedLoginAttempts,
                                     boolean locked) {
        var u = new User(id, email, displayName,
                         authProvider,
                         passwordHash, oidcSubject);
        u.globalRole = globalRole;
        u.failedLoginAttempts = failedLoginAttempts;
        u.locked = locked;
        return u;
    }

    public void promoteToAdmin() { this.globalRole = GlobalRole.ADMIN; }
    public void demoteToUser() { this.globalRole = GlobalRole.USER; }

    public void recordFailedLoginAttempt() {
        this.failedLoginAttempts++;
        if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) this.locked = true;
    }

    public void resetFailedAttempts() { this.failedLoginAttempts = 0; }

    public void unlock() {
        this.locked = false;
        this.failedLoginAttempts = 0;
    }

    public void changePassword(String newHash) {
        if (newHash == null || newHash.isBlank()) throw new IllegalArgumentException("newHash must not be blank");
        this.passwordHash = newHash;
    }

    public boolean isLocked() { return locked; }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public GlobalRole getGlobalRole() { return globalRole; }
    public AuthProvider getAuthProvider() { return authProvider; }
    public String getPasswordHash() { return passwordHash; }
    public String getOidcSubject() { return oidcSubject; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
}
