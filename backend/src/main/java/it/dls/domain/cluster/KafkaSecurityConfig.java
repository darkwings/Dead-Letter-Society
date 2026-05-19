package it.dls.domain.cluster;

public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    String encryptedUsername,    // null for PLAINTEXT/SSL
    String encryptedPassword,    // null for PLAINTEXT
    String encryptedKeystorePem  // null unless SSL
) {
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
