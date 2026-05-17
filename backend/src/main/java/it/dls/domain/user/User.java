package it.dls.domain.user;

import java.util.UUID;

public class User {
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
        this.id = id;
        this.email = email;
        this.displayName = displayName;
        this.authProvider = provider;
        this.globalRole = GlobalRole.USER;
        this.passwordHash = passwordHash;
        this.oidcSubject = oidcSubject;
    }

    public static User createLocal(String email, String displayName, String passwordHash) {
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.LOCAL, passwordHash, null);
    }

    public static User createOidc(String email, String displayName, String subject) {
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.OIDC, null, subject);
    }

    public void promoteToAdmin() { this.globalRole = GlobalRole.ADMIN; }

    public void recordFailedLoginAttempt() {
        this.failedLoginAttempts++;
        if (this.failedLoginAttempts >= 5) this.locked = true;
    }

    public void resetFailedAttempts() { this.failedLoginAttempts = 0; }

    public void unlock() {
        this.locked = false;
        this.failedLoginAttempts = 0;
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
