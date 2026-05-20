package it.dls.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "dlq_messages")
public class DlqMessageEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    @Column(name = "dlq_config_id", columnDefinition = "uuid")
    public UUID dlqConfigId;

    public int partition;

    @Column(name = "kafka_offset")
    public long kafkaOffset;

    @Column(name = "kafka_timestamp")
    public Instant kafkaTimestamp;

    @Column(name = "message_key")
    public byte[] key;

    @Column(name = "raw_payload")
    public byte[] rawPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "decoded_payload", columnDefinition = "jsonb")
    public JsonNode decodedPayload;

    @Column(name = "schema_id")
    public Integer schemaId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Map<String, String> headers;

    @Enumerated(EnumType.STRING)
    public MessageStatus status = MessageStatus.NEW;

    @Column(name = "schema_decode_failed")
    public boolean schemaDecodeFailed;

    @Column(name = "ingested_at")
    public Instant ingestedAt;

    public static DlqMessageEntity fromDomain(DlqMessage m) {
        var e = new DlqMessageEntity();
        e.id = m.getId();
        e.dlqConfigId = m.getDlqConfigId();
        e.partition = m.getPartition();
        e.kafkaOffset = m.getKafkaOffset();
        e.kafkaTimestamp = m.getKafkaTimestamp();
        e.key = m.getKey();
        e.rawPayload = m.getRawPayload();
        e.decodedPayload = m.getDecodedPayload();
        e.schemaId = m.getSchemaId();
        e.headers = m.getHeaders();
        e.status = m.getStatus();
        e.schemaDecodeFailed = m.isSchemaDecodeFailed();
        e.ingestedAt = m.getIngestedAt();
        return e;
    }

    public DlqMessage toDomain() {
        return DlqMessage.reconstitute(
            id, dlqConfigId, partition, kafkaOffset, kafkaTimestamp,
            key, rawPayload, decodedPayload, schemaId, headers,
            status, schemaDecodeFailed, ingestedAt);
    }
}
