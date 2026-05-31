package it.dls.domain.shared;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;

public interface SchemaRegistryPort {

    DecodedPayload decode(byte[] rawPayload, String schemaRegistryUrl,
                          SchemaRegistryAuthConfig auth);

    ValidationResult validate(JsonNode payload, int schemaId,
                               String schemaRegistryUrl, SchemaRegistryAuthConfig auth);

    byte[] encode(JsonNode payload, int schemaId,
                  String schemaRegistryUrl, SchemaRegistryAuthConfig auth);

    default int resolveLatestSchemaId(String subject, String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        throw new UnsupportedOperationException("resolveLatestSchemaId not supported");
    }
}
