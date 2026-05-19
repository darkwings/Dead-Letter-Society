package it.dls.domain.cluster;

public record SchemaRegistryConfig(
    String url,
    String encryptedUsername,  // null if no auth
    String encryptedPassword   // null if no auth
) {
    public SchemaRegistryAuthConfig authConfig() {
        return new SchemaRegistryAuthConfig(encryptedUsername, encryptedPassword);
    }
}
