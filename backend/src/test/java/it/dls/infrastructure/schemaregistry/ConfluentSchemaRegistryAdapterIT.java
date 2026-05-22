package it.dls.infrastructure.schemaregistry;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.confluent.kafka.schemaregistry.avro.AvroSchema;
import io.confluent.kafka.schemaregistry.client.MockSchemaRegistryClient;
import io.confluent.kafka.schemaregistry.client.SchemaRegistryClient;
import io.confluent.kafka.schemaregistry.json.JsonSchema;
import io.confluent.kafka.schemaregistry.protobuf.ProtobufSchema;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.shared.DecodedPayload;
import org.apache.avro.generic.GenericData;
import org.apache.avro.generic.GenericDatumWriter;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.io.EncoderFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SR-001: Avro payload decoded to JSON.
 * SR-002: Protobuf payload decoded to JSON.
 * SR-003: JSON Schema payload decoded to JSON.
 * SR-004: Non-Confluent payload returns raw().
 * SR-005: Null/short payload returns raw().
 * SR-006: Unknown schema ID returns failed().
 */
class ConfluentSchemaRegistryAdapterIT {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private MockSchemaRegistryClient mockClient;
    private ConfluentSchemaRegistryAdapter adapter;

    @BeforeEach
    void setUp() {
        mockClient = new MockSchemaRegistryClient();
        adapter = new ConfluentSchemaRegistryAdapter() {
            @Override
            SchemaRegistryClient buildClient(String url, SchemaRegistryAuthConfig auth) {
                return mockClient;
            }
        };
    }

    // SR-001
    @Test
    void decodeAvroMessage_returnsDecodedFields() throws Exception {
        var avroSchema = new org.apache.avro.Schema.Parser().parse(
            """
            {"type":"record","name":"Order","namespace":"it.dls",
             "fields":[{"name":"id","type":"string"},{"name":"amount","type":"double"}]}
            """
        );
        var parsedSchema = new AvroSchema(avroSchema);
        int schemaId = mockClient.register("order-value", parsedSchema);

        var record = new GenericData.Record(avroSchema);
        record.put("id", "ord-123");
        record.put("amount", 99.99);

        byte[] raw = encodeAvro(avroSchema, schemaId, record);
        DecodedPayload result = adapter.decode(raw, "http://mock-sr", SchemaRegistryAuthConfig.none());

        assertThat(result.isDecoded()).isTrue();
        assertThat(result.format()).isEqualTo("AVRO");
        assertThat(result.schemaId()).isEqualTo(schemaId);
        assertThat(result.payload().get("id").asText()).isEqualTo("ord-123");
        assertThat(result.payload().get("amount").asDouble()).isEqualTo(99.99);
    }

    // SR-002 — disabled: Confluent 7.8.0 ProtobufSchema.toDescriptor() has binary incompatibility
    // with protobuf-java 4.x (forced by Quarkus BOM). Re-enable when upgrading to Confluent 8.x.
    @Test
    @Disabled("Confluent 7.8.0 binary incompatible with protobuf-java 4.x (Quarkus BOM)")
    void decodeProtobufMessage_returnsDecodedFields() throws Exception {
        var protoSchema = new ProtobufSchema(
            "syntax = \"proto3\"; message Order { string id = 1; double amount = 2; }"
        );
        int schemaId = mockClient.register("order-proto-value", protoSchema);

        var descriptor = protoSchema.toDescriptor();
        var msg = com.google.protobuf.DynamicMessage.newBuilder(descriptor)
            .setField(descriptor.findFieldByName("id"), "ord-456")
            .setField(descriptor.findFieldByName("amount"), 49.50)
            .build();

        byte[] raw = encodeProtobuf(msg, schemaId);
        DecodedPayload result = adapter.decode(raw, "http://mock-sr", SchemaRegistryAuthConfig.none());

        assertThat(result.isDecoded()).isTrue();
        assertThat(result.format()).isEqualTo("PROTOBUF");
        assertThat(result.schemaId()).isEqualTo(schemaId);
        assertThat(result.payload().get("id").asText()).isEqualTo("ord-456");
        assertThat(result.payload().get("amount").asDouble()).isEqualTo(49.50);
    }

    // SR-003
    @Test
    void decodeJsonSchemaMessage_returnsDecodedJson() throws Exception {
        var jsonSchema = new JsonSchema(
            """
            {"type":"object","properties":{"orderId":{"type":"string"},"total":{"type":"number"}}}
            """
        );
        int schemaId = mockClient.register("order-json-value", jsonSchema);

        String json = "{\"orderId\":\"j-789\",\"total\":12.34}";
        byte[] raw = encodeJsonSchema(json.getBytes(), schemaId);

        DecodedPayload result = adapter.decode(raw, "http://mock-sr", SchemaRegistryAuthConfig.none());

        assertThat(result.isDecoded()).isTrue();
        assertThat(result.format()).isEqualTo("JSON_SCHEMA");
        assertThat(result.schemaId()).isEqualTo(schemaId);
        assertThat(result.payload().get("orderId").asText()).isEqualTo("j-789");
        assertThat(result.payload().get("total").asDouble()).isEqualTo(12.34);
    }

    // SR-004
    @Test
    void nonConfluentPayload_returnsRaw() {
        byte[] plainJson = "{\"key\":\"value\"}".getBytes();

        DecodedPayload result = adapter.decode(plainJson, "http://mock-sr", SchemaRegistryAuthConfig.none());

        assertThat(result.isDecoded()).isFalse();
        assertThat(result.format()).isEqualTo("RAW");
        assertThat(result.schemaId()).isNull();
    }

    // SR-005
    @Test
    void nullPayload_returnsRaw() {
        assertThat(adapter.decode(null, "http://mock-sr", SchemaRegistryAuthConfig.none()).format())
            .isEqualTo("RAW");
    }

    @Test
    void shortPayload_returnsRaw() {
        assertThat(adapter.decode(new byte[]{0x00, 0x01}, "http://mock-sr", SchemaRegistryAuthConfig.none()).format())
            .isEqualTo("RAW");
    }

    // SR-006
    @Test
    void unknownSchemaId_returnsFailed() {
        // Valid Confluent header with schema ID 99999 (not registered)
        byte[] raw = ByteBuffer.allocate(5)
            .put((byte) 0x00)
            .putInt(99999)
            .array();

        DecodedPayload result = adapter.decode(raw, "http://mock-sr", SchemaRegistryAuthConfig.none());

        assertThat(result.isDecoded()).isFalse();
        assertThat(result.format()).isEqualTo("FAILED");
        assertThat(result.schemaId()).isEqualTo(99999);
    }

    // ─── wire format helpers ─────────────────────────────────────────────────

    private byte[] encodeAvro(org.apache.avro.Schema schema, int schemaId, GenericRecord record)
            throws Exception {
        var baos = new ByteArrayOutputStream();
        baos.write(0x00);
        baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
        var encoder = EncoderFactory.get().binaryEncoder(baos, null);
        new GenericDatumWriter<GenericRecord>(schema).write(record, encoder);
        encoder.flush();
        return baos.toByteArray();
    }

    private byte[] encodeProtobuf(com.google.protobuf.DynamicMessage msg, int schemaId)
            throws Exception {
        var baos = new ByteArrayOutputStream();
        baos.write(0x00);
        baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
        // Confluent Protobuf message indexes: count=1, index=0 (root message)
        baos.write(0x01); // varint: array count = 1
        baos.write(0x00); // varint: message index = 0
        baos.write(msg.toByteArray());
        return baos.toByteArray();
    }

    private byte[] encodeJsonSchema(byte[] jsonBytes, int schemaId) throws Exception {
        var baos = new ByteArrayOutputStream();
        baos.write(0x00);
        baos.write(ByteBuffer.allocate(4).putInt(schemaId).array());
        baos.write(jsonBytes);
        return baos.toByteArray();
    }
}
