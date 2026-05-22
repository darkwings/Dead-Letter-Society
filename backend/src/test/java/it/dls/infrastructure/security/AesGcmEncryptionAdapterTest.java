package it.dls.infrastructure.security;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AesGcmEncryptionAdapterTest {

    private final AesGcmEncryptionAdapter enc =
        new AesGcmEncryptionAdapter("0123456789abcdef0123456789abcdef");

    @Test
    void encryptDecryptRoundTrip() {
        String cipher = enc.encrypt("super-secret");
        assertThat(enc.decrypt(cipher)).isEqualTo("super-secret");
    }

    @Test
    void differentCiphertextEachTime() {
        assertThat(enc.encrypt("x")).isNotEqualTo(enc.encrypt("x"));
    }

    @Test
    void decryptTamperedCiphertextThrows() {
        String cipher = enc.encrypt("data");
        String tampered = cipher.substring(0, cipher.length() - 4) + "XXXX";
        assertThatThrownBy(() -> enc.decrypt(tampered))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void keyTooShortThrows() {
        assertThatThrownBy(() -> new AesGcmEncryptionAdapter("short"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("32 bytes");
    }

    @Test
    void encryptEmptyStringRoundTrips() {
        String cipher = enc.encrypt("");
        assertThat(enc.decrypt(cipher)).isEqualTo("");
    }
}
