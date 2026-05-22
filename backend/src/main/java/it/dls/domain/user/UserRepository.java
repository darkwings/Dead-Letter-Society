package it.dls.domain.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    void save(User user);
    Optional<User> findById(UUID id);
    Optional<User> findByEmail(String email);
    Optional<User> findByOidcSubject(String subject);
    boolean existsAny();
    List<User> findAll();
}
