package it.dls.domain.cluster;

import it.dls.domain.shared.EncryptionPort;

public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    boolean tlsEnabled,
    String encryptedUsername,
    String encryptedPassword,
    String encryptedKeystorePem
) {
    public KafkaSecurityConfig {
        if (protocol == null) throw new IllegalArgumentException("protocol must not be null");
        if (protocol == KafkaSecurityProtocol.SASL_PLAIN
                || protocol == KafkaSecurityProtocol.SASL_SCRAM_SHA_256
                || protocol == KafkaSecurityProtocol.SASL_SCRAM_SHA_512) {
            if (encryptedUsername == null || encryptedPassword == null)
                throw new IllegalArgumentException(
                    protocol + " requires encryptedUsername and encryptedPassword");
        }
        if (protocol == KafkaSecurityProtocol.SSL && encryptedKeystorePem == null)
            throw new IllegalArgumentException("SSL requires encryptedKeystorePem");
    }

    public static KafkaSecurityConfig plaintext() {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.PLAINTEXT, false, null, null, null);
    }

    public static KafkaSecurityConfig ssl(String encryptedKeystorePem) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SSL, true, null, null, encryptedKeystorePem);
    }

    public static KafkaSecurityConfig saslPlain(String encryptedUsername, String encryptedPassword,
                                                 boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }

    public static KafkaSecurityConfig saslScram256(String encryptedUsername, String encryptedPassword,
                                                    boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_SCRAM_SHA_256,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }

    public static KafkaSecurityConfig saslScram512(String encryptedUsername, String encryptedPassword,
                                                    boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_SCRAM_SHA_512,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }

    public KafkaSecurityConfig decrypted(EncryptionPort encryption) {
        return new KafkaSecurityConfig(
            protocol, tlsEnabled,
            encryptedUsername != null ? encryption.decrypt(encryptedUsername) : null,
            encryptedPassword != null ? encryption.decrypt(encryptedPassword) : null,
            encryptedKeystorePem != null ? encryption.decrypt(encryptedKeystorePem) : null
        );
    }
}
