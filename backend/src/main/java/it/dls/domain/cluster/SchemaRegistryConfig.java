package it.dls.domain.cluster;

public record SchemaRegistryConfig(
    String url,
    String encryptedUsername,      // null if no auth
    String encryptedPassword,      // null if no auth
    String encryptedTruststorePem  // null = use JVM default cacerts (public CA)
) {
    public SchemaRegistryConfig {
        if (url == null || url.isBlank())
            throw new IllegalArgumentException("SchemaRegistryConfig url must not be blank");
    }

    public SchemaRegistryAuthConfig authConfig() {
        return new SchemaRegistryAuthConfig(encryptedUsername, encryptedPassword, encryptedTruststorePem);
    }
}
