package it.dls.infrastructure.schemaregistry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.shared.DecodedPayload;
import it.dls.domain.shared.SchemaRegistryPort;
import it.dls.domain.shared.ValidationResult;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

import java.nio.charset.StandardCharsets;

@DefaultBean
@ApplicationScoped
public class JsonSchemaRegistryAdapter implements SchemaRegistryPort {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public DecodedPayload decode(byte[] rawPayload, String schemaRegistryUrl,
                                  SchemaRegistryAuthConfig auth) {
        try {
            JsonNode node = MAPPER.readTree(rawPayload);
            return new DecodedPayload(node, null, "PLAIN_JSON");
        } catch (Exception e) {
            throw new RuntimeException("Failed to decode payload as JSON: " + e.getMessage(), e);
        }
    }

    @Override
    public ValidationResult validate(JsonNode payload, int schemaId,
                                      String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        return ValidationResult.ok();
    }

    @Override
    public byte[] encode(JsonNode payload, int schemaId,
                         String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        return payload.toString().getBytes(StandardCharsets.UTF_8);
    }
}
