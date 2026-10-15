package it.dls.infrastructure.api.message;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.FailureInfo;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
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
    String rawPayload,
    String key,
    Map<String, String> headers,
    JsonNode replayedDecodedPayload,
    FailureInfo failureInfo
) {
    public static MessageResponse from(DlqMessage m, FailureInfo info) {
        return new MessageResponse(
            m.getId(), m.getDlqConfigId(), m.getPartition(), m.getKafkaOffset(),
            m.getKafkaTimestamp(), m.getStatus().name(), m.isSchemaDecodeFailed(),
            m.getSchemaId(), m.getIngestedAt(), m.getDecodedPayload(),
            decodeBytes(m.getRawPayload()),
            decodeBytes(m.getKey()),
            m.getHeaders(),
            m.getReplayedDecodedPayload(),
            info != null ? info : FailureInfo.empty()
        );
    }

    private static String decodeBytes(byte[] bytes) {
        if (bytes == null) return null;
        // Try UTF-8 first; fall back to Base64 for binary payloads (Avro, Protobuf)
        try {
            String s = new String(bytes, StandardCharsets.UTF_8);
            // Reject if it contains replacement characters (invalid UTF-8)
            for (char c : s.toCharArray()) {
                if (c == '�') return Base64.getEncoder().encodeToString(bytes);
            }
            return s;
        } catch (Exception e) {
            return Base64.getEncoder().encodeToString(bytes);
        }
    }
}
