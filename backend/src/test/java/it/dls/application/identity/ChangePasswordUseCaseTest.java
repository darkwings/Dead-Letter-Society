package it.dls.application.identity;

import it.dls.domain.user.AuthProvider;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChangePasswordUseCaseTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final PasswordHashPort hasher = mock(PasswordHashPort.class);
    private final ChangePasswordUseCase useCase = new ChangePasswordUseCase(repo, hasher);

    @Test
    void changeSelf_correctCurrentPassword_updatesAndSaves() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("old", "oldhash")).thenReturn(true);
        when(hasher.hash("newpassword1")).thenReturn("newhash");

        useCase.changeSelf(user.getId(), "old", "newpassword1");

        verify(repo).save(argThat(u -> u.getPasswordHash().equals("newhash")));
    }

    @Test
    void changeSelf_wrongCurrentPassword_throwsSecurityException() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("wrong", "oldhash")).thenReturn(false);

        assertThatThrownBy(() -> useCase.changeSelf(user.getId(), "wrong", "newpassword1"))
            .isInstanceOf(SecurityException.class)
            .hasMessage("invalid-current-password");
        verify(repo, never()).save(any());
    }

    @Test
    void changeSelf_newPasswordTooShort_throwsIllegalArgument() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("old", "oldhash")).thenReturn(true);

        assertThatThrownBy(() -> useCase.changeSelf(user.getId(), "old", "short"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void adminReset_localUser_updatesAndSaves() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.hash("newpassword1")).thenReturn("newhash");

        useCase.adminReset(user.getId(), "newpassword1");

        verify(repo).save(argThat(u -> u.getPasswordHash().equals("newhash")));
    }

    @Test
    void adminReset_oidcUser_throwsIllegalState() {
        var user = User.createOidc("o@dls.io", "O", "sub123");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> useCase.adminReset(user.getId(), "newpassword1"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("cannot-reset-oidc-user");
        verify(repo, never()).save(any());
    }

    @Test
    void adminReset_newPasswordTooShort_throwsIllegalArgument() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> useCase.adminReset(user.getId(), "short"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void changeSelf_userNotFound_throwsIllegalArgument() {
        UUID unknown = UUID.randomUUID();
        when(repo.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.changeSelf(unknown, "old", "newpassword1"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
