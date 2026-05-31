package it.dls.domain.message;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;

public class DlqMessage {

    private UUID id;
    private UUID dlqConfigId;
    private int partition;
    private long kafkaOffset;
    private Instant kafkaTimestamp;
    private byte[] key;
    private byte[] rawPayload;
    private JsonNode decodedPayload;  // null when schemaDecodeFailed=true
    private Integer schemaId;
    private Map<String, String> headers;
    private MessageStatus status;
    private boolean schemaDecodeFailed;
    private Instant ingestedAt;
    private JsonNode replayedDecodedPayload;  // null unless replayed with edited payload
    private byte[] replayedRawPayload;        // encoded bytes actually sent during replay

    private DlqMessage() {}

    public static DlqMessage ingest(
            UUID dlqConfigId, int partition, long kafkaOffset,
            Instant kafkaTimestamp, byte[] key, byte[] rawPayload,
            JsonNode decodedPayload, Integer schemaId,
            Map<String, String> headers, boolean schemaDecodeFailed) {
        if (dlqConfigId == null) throw new IllegalArgumentException("dlqConfigId required");
        if (rawPayload == null) throw new IllegalArgumentException("rawPayload required");
        var m = new DlqMessage();
        m.id = UUID.randomUUID();
        m.dlqConfigId = dlqConfigId;
        m.partition = partition;
        m.kafkaOffset = kafkaOffset;
        m.kafkaTimestamp = kafkaTimestamp != null ? kafkaTimestamp : Instant.now();
        m.key = key;
        m.rawPayload = rawPayload;
        m.decodedPayload = decodedPayload;
        m.schemaId = schemaId;
        m.headers = headers != null ? Collections.unmodifiableMap(headers) : Map.of();
        m.status = MessageStatus.NEW;
        m.schemaDecodeFailed = schemaDecodeFailed;
        m.ingestedAt = Instant.now();
        return m;
    }

    public static DlqMessage reconstitute(
            UUID id, UUID dlqConfigId, int partition, long kafkaOffset,
            Instant kafkaTimestamp, byte[] key, byte[] rawPayload,
            JsonNode decodedPayload, Integer schemaId, Map<String, String> headers,
            MessageStatus status, boolean schemaDecodeFailed, Instant ingestedAt,
            JsonNode replayedDecodedPayload, byte[] replayedRawPayload) {
        var m = new DlqMessage();
        m.id = id;
        m.dlqConfigId = dlqConfigId;
        m.partition = partition;
        m.kafkaOffset = kafkaOffset;
        m.kafkaTimestamp = kafkaTimestamp;
        m.key = key;
        m.rawPayload = rawPayload;
        m.decodedPayload = decodedPayload;
        m.schemaId = schemaId;
        m.headers = headers != null ? Collections.unmodifiableMap(headers) : Map.of();
        m.status = status;
        m.schemaDecodeFailed = schemaDecodeFailed;
        m.ingestedAt = ingestedAt;
        m.replayedDecodedPayload = replayedDecodedPayload;
        m.replayedRawPayload = replayedRawPayload;
        return m;
    }

    public void transitionTo(MessageStatus newStatus) {
        this.status = newStatus;
    }

    public void setReplayedPayload(JsonNode decoded, byte[] raw) {
        this.replayedDecodedPayload = decoded;
        this.replayedRawPayload = raw;
    }

    public UUID getId() { return id; }
    public UUID getDlqConfigId() { return dlqConfigId; }
    public int getPartition() { return partition; }
    public long getKafkaOffset() { return kafkaOffset; }
    public Instant getKafkaTimestamp() { return kafkaTimestamp; }
    public byte[] getKey() { return key; }
    public byte[] getRawPayload() { return rawPayload; }
    public JsonNode getDecodedPayload() { return decodedPayload; }
    public Integer getSchemaId() { return schemaId; }
    public Map<String, String> getHeaders() { return headers; }
    public MessageStatus getStatus() { return status; }
    public boolean isSchemaDecodeFailed() { return schemaDecodeFailed; }
    public Instant getIngestedAt() { return ingestedAt; }
    public JsonNode getReplayedDecodedPayload() { return replayedDecodedPayload; }
    public byte[] getReplayedRawPayload() { return replayedRawPayload; }
}
