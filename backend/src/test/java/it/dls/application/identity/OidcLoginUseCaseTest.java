package it.dls.application.identity;

import it.dls.domain.user.GlobalRole;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OidcLoginUseCaseTest {

    private final UserRepository userRepository = mock(UserRepository.class);

    private OidcLoginUseCase useCase() {
        return new OidcLoginUseCase(userRepository, "roles", "dls-admin");
    }

    private OidcClaims emptyClaims() {
        return OidcClaims.empty();
    }

    private OidcClaims claimsWithAdmin() {
        return new OidcClaims(Map.of("roles", List.of("dls-admin")));
    }

    @Test
    void newOidcUser_provisionedAsUser() {
        when(userRepository.findByOidcSubject("sub-123")).thenReturn(Optional.empty());

        User result = useCase()
            .loginOrProvision("sub-123", "test@oidc.io", "Test User", emptyClaims());

        assertThat(result.getGlobalRole()).isEqualTo(GlobalRole.USER);
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void newOidcUser_withAdminClaim_provisionedAsAdmin() {
        when(userRepository.findByOidcSubject("sub-123")).thenReturn(Optional.empty());

        User result = useCase()
            .loginOrProvision("sub-123", "test@oidc.io", "Test User", claimsWithAdmin());

        assertThat(result.getGlobalRole()).isEqualTo(GlobalRole.ADMIN);
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void existingOidcUser_syncedToAdmin_whenClaimPresent() {
        User existingUser = User.createOidc("test@oidc.io", "Test User", "sub-123");
        assertThat(existingUser.getGlobalRole()).isEqualTo(GlobalRole.USER);
        when(userRepository.findByOidcSubject("sub-123")).thenReturn(Optional.of(existingUser));

        User result = useCase()
            .loginOrProvision("sub-123", "test@oidc.io", "Test User", claimsWithAdmin());

        assertThat(result.getGlobalRole()).isEqualTo(GlobalRole.ADMIN);
        verify(userRepository, times(1)).save(existingUser);
    }

    @Test
    void existingOidcAdmin_demotedToUser_whenClaimRevoked() {
        User existingUser = User.createOidc("test@oidc.io", "Test User", "sub-123");
        existingUser.promoteToAdmin();
        assertThat(existingUser.getGlobalRole()).isEqualTo(GlobalRole.ADMIN);
        when(userRepository.findByOidcSubject("sub-123")).thenReturn(Optional.of(existingUser));

        User result = useCase()
            .loginOrProvision("sub-123", "test@oidc.io", "Test User", emptyClaims());

        assertThat(result.getGlobalRole()).isEqualTo(GlobalRole.USER);
        verify(userRepository, times(1)).save(existingUser);
    }
}
