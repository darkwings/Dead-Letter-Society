package it.dls.domain.shared;

import com.fasterxml.jackson.databind.JsonNode;

public record DecodedPayload(JsonNode payload, Integer schemaId, String format) {}
