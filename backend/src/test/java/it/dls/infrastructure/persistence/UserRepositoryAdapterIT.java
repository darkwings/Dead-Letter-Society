package it.dls.infrastructure.persistence;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.TestTransaction;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class UserRepositoryAdapterIT {

    @Inject
    UserRepository repo;

    @Test
    @TestTransaction
    void saveAndFindByEmail() {
        var user = User.createLocal("it-save@dls.io", "IT User", "hash");
        repo.save(user);
        var found = repo.findByEmail("it-save@dls.io");
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("it-save@dls.io");
    }

    @Test
    @TestTransaction
    void existsAnyReturnsTrueAfterSave() {
        var user = User.createLocal("it-exists@dls.io", "IT User 2", "hash");
        repo.save(user);
        assertThat(repo.existsAny()).isTrue();
    }

    @Test
    @TestTransaction
    void findByOidcSubject() {
        var user = User.createOidc("it-oidc@dls.io", "OIDC User", "sub-123");
        repo.save(user);
        var found = repo.findByOidcSubject("sub-123");
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("it-oidc@dls.io");
    }

    @Test
    @TestTransaction
    void lockoutStatePersistedAndReconstituted() {
        var user = User.createLocal("it-lock@dls.io", "Lock User", "hash");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        repo.save(user);
        var found = repo.findByEmail("it-lock@dls.io");
        assertThat(found).isPresent();
        assertThat(found.get().isLocked()).isTrue();
        assertThat(found.get().getFailedLoginAttempts()).isEqualTo(5);
    }
}
