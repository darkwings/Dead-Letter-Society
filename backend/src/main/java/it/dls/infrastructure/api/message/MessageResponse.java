package it.dls.infrastructure.api.message;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.message.DlqMessage;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record MessageResponse(
    UUID id,
    UUID dlqConfigId,
    int partition,
    long kafkaOffset,
    Instant kafkaTimestamp,
    String status,
    boolean schemaDecodeFailed,
    Integer schemaId,
    Instant ingestedAt,
    JsonNode decodedPayload,
    byte[] rawPayload,
    byte[] key,
    Map<String, String> headers
) {
    public static MessageResponse from(DlqMessage m) {
        return new MessageResponse(
            m.getId(), m.getDlqConfigId(), m.getPartition(), m.getKafkaOffset(),
            m.getKafkaTimestamp(), m.getStatus().name(), m.isSchemaDecodeFailed(),
            m.getSchemaId(), m.getIngestedAt(), m.getDecodedPayload(),
            m.getRawPayload(), m.getKey(), m.getHeaders()
        );
    }
}
