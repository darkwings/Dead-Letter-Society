package it.dls.application.identity;

import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class LoginUseCaseTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final PasswordHashPort hasher = mock(PasswordHashPort.class);
    private final LoginUseCase useCase = new LoginUseCase(repo, hasher);

    @Test
    void lockedAccountReturnsFailure() {
        var user = User.createLocal("u@dls.io", "U", "hash");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        when(repo.findByEmail("u@dls.io")).thenReturn(Optional.of(user));
        var result = useCase.login("u@dls.io", "any");
        assertThat(result.isFailure()).isTrue();
        assertThat(result.failureReason()).isEqualTo(LoginFailure.ACCOUNT_LOCKED);
        verify(repo, never()).save(any());
    }

    @Test
    void wrongPasswordIncrementsCounter() {
        var user = User.createLocal("u@dls.io", "U", "hash");
        when(repo.findByEmail("u@dls.io")).thenReturn(Optional.of(user));
        when(hasher.verify("wrong", "hash")).thenReturn(false);
        useCase.login("u@dls.io", "wrong");
        verify(repo).save(argThat(u -> u.getFailedLoginAttempts() == 1));
    }

    @Test
    void unknownEmailReturnsInvalidCredentials() {
        when(repo.findByEmail("unknown@dls.io")).thenReturn(Optional.empty());
        when(hasher.verify(any(), any())).thenReturn(false);
        var result = useCase.login("unknown@dls.io", "password");
        assertThat(result.isFailure()).isTrue();
        assertThat(result.failureReason()).isEqualTo(LoginFailure.INVALID_CREDENTIALS);
    }

    @Test
    void correctPasswordResetsCounter() {
        var user = User.createLocal("u@dls.io", "U", "hash");
        user.recordFailedLoginAttempt();
        when(repo.findByEmail("u@dls.io")).thenReturn(Optional.of(user));
        when(hasher.verify("correct", "hash")).thenReturn(true);
        var result = useCase.login("u@dls.io", "correct");
        assertThat(result.isSuccess()).isTrue();
        verify(repo).save(argThat(u -> u.getFailedLoginAttempts() == 0));
    }
}
