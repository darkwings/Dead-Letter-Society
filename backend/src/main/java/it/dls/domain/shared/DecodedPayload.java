package it.dls.domain.shared;

import com.fasterxml.jackson.databind.JsonNode;

public record DecodedPayload(JsonNode payload, Integer schemaId, String format) {

    public static DecodedPayload decoded(JsonNode payload, int schemaId, String format) {
        return new DecodedPayload(payload, schemaId, format);
    }

    /** Payload is not in Confluent wire format — no schema decode attempted. */
    public static DecodedPayload raw() {
        return new DecodedPayload(null, null, "RAW");
    }

    /** Confluent wire format detected but schema decode failed. */
    public static DecodedPayload failed(int schemaId) {
        return new DecodedPayload(null, schemaId, "FAILED");
    }

    public boolean isDecoded() {
        return payload != null;
    }
}
