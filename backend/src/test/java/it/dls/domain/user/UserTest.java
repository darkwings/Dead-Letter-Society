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
    void userIsLockedAfterFiveFailedAttempts() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        assertThat(user.isLocked()).isTrue();
    }

    @Test
    void userIsNotLockedBeforeThreshold() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 4; i++) user.recordFailedLoginAttempt();
        assertThat(user.isLocked()).isFalse();
    }

    @Test
    void adminCanUnlockUser() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        user.unlock();
        assertThat(user.isLocked()).isFalse();
        assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
    }

    @Test
    void changePassword_updatesHash() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        user.changePassword("newhash");
        assertThat(user.getPasswordHash()).isEqualTo("newhash");
    }

    @Test
    void changePassword_rejectsBlankHash() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        assertThatThrownBy(() -> user.changePassword(""))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void changePassword_rejectsNullHash() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        assertThatThrownBy(() -> user.changePassword(null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
