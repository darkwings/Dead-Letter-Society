package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.user.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    public String email;

    @Column(name = "display_name")
    public String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider")
    public AuthProvider authProvider;

    @Enumerated(EnumType.STRING)
    @Column(name = "global_role")
    public GlobalRole globalRole;

    @Column(name = "password_hash")
    public String passwordHash;

    @Column(name = "oidc_subject")
    public String oidcSubject;

    @Column(name = "failed_login_attempts")
    public int failedLoginAttempts;

    public boolean locked;

    @Column(name = "created_at")
    public Instant createdAt;

    @Column(name = "updated_at")
    public Instant updatedAt;

    public static UserEntity fromDomain(User u) {
        var e = new UserEntity();
        e.id = u.getId();
        e.email = u.getEmail();
        e.displayName = u.getDisplayName();
        e.authProvider = u.getAuthProvider();
        e.globalRole = u.getGlobalRole();
        e.passwordHash = u.getPasswordHash();
        e.oidcSubject = u.getOidcSubject();
        e.failedLoginAttempts = u.getFailedLoginAttempts();
        e.locked = u.isLocked();
        e.createdAt = Instant.now();
        e.updatedAt = Instant.now();
        return e;
    }

    public User toDomain() {
        return User.reconstitute(id, email, displayName, passwordHash, oidcSubject,
                                 globalRole, failedLoginAttempts, locked);
    }
}
