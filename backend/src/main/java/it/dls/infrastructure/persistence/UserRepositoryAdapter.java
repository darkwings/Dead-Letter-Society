package it.dls.infrastructure.persistence;

import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class UserRepositoryAdapter implements UserRepository {

    @Override
    @Transactional
    public void save(User user) {
        UserEntity existing = UserEntity.findById(user.getId());
        if (existing == null) {
            UserEntity.fromDomain(user).persist();
        } else {
            existing.globalRole = user.getGlobalRole();
            existing.passwordHash = user.getPasswordHash();
            existing.failedLoginAttempts = user.getFailedLoginAttempts();
            existing.locked = user.isLocked();
            existing.updatedAt = Instant.now();
        }
    }

    @Override
    public Optional<User> findById(UUID id) {
        return UserEntity.<UserEntity>findByIdOptional(id).map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return UserEntity.<UserEntity>find("email", email).firstResultOptional()
                         .map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByOidcSubject(String subject) {
        return UserEntity.<UserEntity>find("oidcSubject", subject).firstResultOptional()
                         .map(UserEntity::toDomain);
    }

    @Override
    public boolean existsAny() {
        return UserEntity.count() > 0;
    }
}
