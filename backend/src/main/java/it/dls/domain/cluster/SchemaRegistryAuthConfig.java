package it.dls.domain.cluster;

import it.dls.domain.shared.EncryptionPort;

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

    public SchemaRegistryAuthConfig decrypted(EncryptionPort encryption) {
        if (!hasCredentials()) return none();
        return new SchemaRegistryAuthConfig(
            encryption.decrypt(encryptedUsername),
            encryption.decrypt(encryptedPassword)
        );
    }
}
