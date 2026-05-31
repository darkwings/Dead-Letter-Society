package it.dls.infrastructure.schemaregistry;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class JsonSchemaRegistryAdapterTest {

    private final JsonSchemaRegistryAdapter adapter = new JsonSchemaRegistryAdapter();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void encode_returnsUtf8JsonBytes() throws Exception {
        var payload = MAPPER.readTree("{\"id\":\"abc\",\"amount\":9.99}");

        byte[] result = adapter.encode(payload, 0, null, SchemaRegistryAuthConfig.none());

        assertThat(new String(result, StandardCharsets.UTF_8)).isEqualTo(payload.toString());
    }
}
