package it.dls.infrastructure.schemaregistry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.protobuf.DynamicMessage;
import com.google.protobuf.util.JsonFormat;
import io.confluent.kafka.schemaregistry.avro.AvroSchema;
import io.confluent.kafka.schemaregistry.client.CachedSchemaRegistryClient;
import io.confluent.kafka.schemaregistry.client.SchemaRegistryClient;
import io.confluent.kafka.schemaregistry.client.rest.exceptions.RestClientException;
import io.confluent.kafka.schemaregistry.protobuf.ProtobufSchema;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.shared.DecodedPayload;
import it.dls.domain.shared.SchemaRegistryPort;
import it.dls.domain.shared.ValidationResult;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.avro.generic.GenericDatumReader;
import org.apache.avro.generic.GenericDatumWriter;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.io.DecoderFactory;
import org.apache.avro.io.EncoderFactory;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.jboss.logging.Logger;

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class ConfluentSchemaRegistryAdapter implements SchemaRegistryPort {

    private static final Logger log = Logger.getLogger(ConfluentSchemaRegistryAdapter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public DecodedPayload decode(byte[] rawPayload, String url, SchemaRegistryAuthConfig auth) {
        if (rawPayload == null || rawPayload.length < 5 || rawPayload[0] != 0x00) {
            return DecodedPayload.raw();
        }

        int schemaId = ByteBuffer.wrap(rawPayload, 1, 4).getInt();
        try {
            var client = buildClient(url, auth);
            var schema = client.getSchemaById(schemaId);
            return switch (schema.schemaType()) {
                case "AVRO"     -> decodeAvro(rawPayload, (AvroSchema) schema, schemaId);
                case "PROTOBUF" -> decodeProtobuf(rawPayload, (ProtobufSchema) schema, schemaId);
                case "JSON"     -> decodeJsonSchema(rawPayload, schemaId);
                default -> DecodedPayload.raw();
            };
        } catch (Throwable t) {
            // Catches VerifyError too — Confluent ProtobufSchema has binary incompatibility
            // with protobuf-java 4.x (Quarkus BOM). Decode fails gracefully.
            log.warnf("Schema decode failed for schemaId=%d url=%s: %s", schemaId, url, t.getMessage());
            return DecodedPayload.failed(schemaId);
        }
    }

    @Override
    public ValidationResult validate(JsonNode payload, int schemaId,
                                     String url, SchemaRegistryAuthConfig auth) {
        try {
            var client = buildClient(url, auth);
            client.getSchemaById(schemaId);
            return ValidationResult.ok();
        } catch (RestClientException e) {
            return ValidationResult.fail("Schema not found: " + schemaId);
        } catch (Exception e) {
            return ValidationResult.fail(e.getMessage());
        }
    }

    @Override
    public byte[] encode(JsonNode payload, int schemaId,
                         String schemaRegistryUrl, SchemaRegistryAuthConfig auth) {
        try {
            var client = buildClient(schemaRegistryUrl, auth);
            var schema = client.getSchemaById(schemaId);
            return switch (schema.schemaType()) {
                case "AVRO"     -> encodeAvro(payload, (AvroSchema) schema, schemaId);
                case "JSON"     -> encodeJsonSchema(payload, schemaId);
                case "PROTOBUF" -> throw new UnsupportedOperationException(
                                       "Protobuf encode not supported — blocked on Confluent 8.x upgrade");
                default -> payload.toString().getBytes(StandardCharsets.UTF_8);
            };
        } catch (UnsupportedOperationException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Encode failed for schemaId=" + schemaId + ": " + e.getMessage(), e);
        }
    }

    private byte[] encodeAvro(JsonNode payload, AvroSchema schema, int schemaId) throws Exception {
        var avroSchema = schema.rawSchema();
        var reader = new GenericDatumReader<GenericRecord>(avroSchema);
        var decoder = DecoderFactory.get().jsonDecoder(avroSchema, payload.toString());
        var record = reader.read(null, decoder);

        var baos = new ByteArrayOutputStream();
        baos.write(0x00);
        baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
        var encoder = EncoderFactory.get().binaryEncoder(baos, null);
        new GenericDatumWriter<GenericRecord>(avroSchema).write(record, encoder);
        encoder.flush();
        return baos.toByteArray();
    }

    private byte[] encodeJsonSchema(JsonNode payload, int schemaId) throws Exception {
        var baos = new ByteArrayOutputStream();
        baos.write(0x00);
        baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
        baos.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        return baos.toByteArray();
    }

    SchemaRegistryClient buildClient(String url, SchemaRegistryAuthConfig auth) {
        Map<String, Object> config = new HashMap<>();
        if (auth.hasCredentials()) {
            config.put("schema.registry.basic.auth.credentials.source", "USER_INFO");
            config.put("schema.registry.basic.auth.user.info",
                auth.encryptedUsername() + ":" + auth.encryptedPassword());
        }
        return new CachedSchemaRegistryClient(url, 100, config);
    }

    private DecodedPayload decodeAvro(byte[] raw, AvroSchema schema, int schemaId) throws Exception {
        var avroSchema = schema.rawSchema();
        var reader = new GenericDatumReader<GenericRecord>(avroSchema);
        var decoder = DecoderFactory.get().binaryDecoder(raw, 5, raw.length - 5, null);
        var record = reader.read(null, decoder);
        return DecodedPayload.decoded(MAPPER.readTree(record.toString()), schemaId, "AVRO");
    }

    private DecodedPayload decodeProtobuf(byte[] raw, ProtobufSchema schema, int schemaId) throws Exception {
        var buf = ByteBuffer.wrap(raw);
        buf.position(5); // skip magic byte + 4-byte schema ID
        // Confluent Protobuf wire format: array of message-path varints (count, then each index)
        int count = readVarint(buf);
        for (int i = 0; i < count; i++) {
            readVarint(buf);
        }
        int bodyOffset = buf.position();
        byte[] body = Arrays.copyOfRange(raw, bodyOffset, raw.length);
        var descriptor = schema.toDescriptor();
        var msg = DynamicMessage.parseFrom(descriptor, body);
        String json = JsonFormat.printer().includingDefaultValueFields().print(msg);
        return DecodedPayload.decoded(MAPPER.readTree(json), schemaId, "PROTOBUF");
    }

    private DecodedPayload decodeJsonSchema(byte[] raw, int schemaId) throws Exception {
        byte[] jsonBytes = Arrays.copyOfRange(raw, 5, raw.length);
        return DecodedPayload.decoded(MAPPER.readTree(jsonBytes), schemaId, "JSON_SCHEMA");
    }

    private static int readVarint(ByteBuffer buf) {
        int result = 0, shift = 0;
        byte b;
        do {
            b = buf.get();
            result |= (b & 0x7F) << shift;
            shift += 7;
        } while ((b & 0x80) != 0);
        return result;
    }
}
