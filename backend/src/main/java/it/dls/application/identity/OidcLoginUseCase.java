package it.dls.application.identity;

import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;

public class OidcLoginUseCase {

    private final UserRepository userRepository;
    private final String adminClaimName;
    private final String adminClaimValue;

    public OidcLoginUseCase(UserRepository userRepository,
                             String adminClaimName,
                             String adminClaimValue) {
        this.userRepository = userRepository;
        this.adminClaimName = adminClaimName;
        this.adminClaimValue = adminClaimValue;
    }

    public User loginOrProvision(String subject, String email,
                                 String displayName, OidcClaims claims) {
        return userRepository.findByOidcSubject(subject)
            .map(user -> syncAdminRole(user, claims))
            .orElseGet(() -> provision(subject, email, displayName, claims));
    }

    private User provision(String subject, String email,
                           String displayName, OidcClaims claims) {
        User user = User.createOidc(email, displayName, subject);
        if (hasAdminClaim(claims)) user.promoteToAdmin();
        userRepository.save(user);
        return user;
    }

    private User syncAdminRole(User user, OidcClaims claims) {
        if (hasAdminClaim(claims)) {
            user.promoteToAdmin();
        } else {
            user.demoteToUser();
        }
        userRepository.save(user);
        return user;
    }

    private boolean hasAdminClaim(OidcClaims claims) {
        return claims.getValues(adminClaimName).contains(adminClaimValue);
    }
}
