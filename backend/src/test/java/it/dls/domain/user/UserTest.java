package it.dls.domain.user;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class UserTest {

    @Test
    void firstUserBecomesAdmin() {
        var user = User.createLocal("admin@dls.io", "Admin User", "hashedpwd");
        user.promoteToAdmin();
        assertThat(user.getGlobalRole()).isEqualTo(GlobalRole.ADMIN);
    }

    @Test
    void lockedUserCannotAuthenticate() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        assertThat(user.isLocked()).isTrue();
    }

    @Test
    void adminCanUnlockUser() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        user.unlock();
        assertThat(user.isLocked()).isFalse();
        assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
    }
}
