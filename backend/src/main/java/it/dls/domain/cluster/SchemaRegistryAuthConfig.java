package it.dls.domain.cluster;

import it.dls.domain.shared.EncryptionPort;

public record SchemaRegistryAuthConfig(
    String encryptedUsername,   // null if no auth
    String encryptedPassword,   // null if no auth
    String truststorePem        // null = use JVM default cacerts; already decrypted at call site
) {
    public static SchemaRegistryAuthConfig none() {
        return new SchemaRegistryAuthConfig(null, null, null);
    }

    public boolean hasCredentials() {
        return encryptedUsername != null;
    }

    public boolean hasTruststore() {
        return truststorePem != null && !truststorePem.isBlank();
    }

    public SchemaRegistryAuthConfig decrypted(EncryptionPort encryption) {
        return new SchemaRegistryAuthConfig(
            encryptedUsername != null ? encryption.decrypt(encryptedUsername) : null,
            encryptedPassword != null ? encryption.decrypt(encryptedPassword) : null,
            truststorePem != null ? encryption.decrypt(truststorePem) : null
        );
    }
}
