package it.dls.domain.cluster;

public record SchemaRegistryAuthConfig(
    String encryptedUsername,  // null if no auth
    String encryptedPassword   // null if no auth
) {
    public static SchemaRegistryAuthConfig none() {
        return new SchemaRegistryAuthConfig(null, null);
    }

    public boolean hasCredentials() {
        return encryptedUsername != null;
    }
}
