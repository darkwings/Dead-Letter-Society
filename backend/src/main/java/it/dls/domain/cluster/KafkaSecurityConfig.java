package it.dls.domain.cluster;

public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    String encryptedUsername,    // null for PLAINTEXT/SSL
    String encryptedPassword,    // null for PLAINTEXT
    String encryptedKeystorePem  // null unless SSL
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
        return new KafkaSecurityConfig(KafkaSecurityProtocol.PLAINTEXT, null, null, null);
    }

    public static KafkaSecurityConfig saslPlain(String encryptedUsername, String encryptedPassword) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN,
            encryptedUsername, encryptedPassword, null);
    }

    public static KafkaSecurityConfig ssl(String encryptedKeystorePem) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SSL, null, null, encryptedKeystorePem);
    }
}
