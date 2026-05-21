package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.message.ReplayAuditRecord;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "replay_audit_records")
public class ReplayAuditRecordEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    @Column(name = "message_id", columnDefinition = "uuid", nullable = false)
    public UUID messageId;

    @Column(name = "replayed_by", columnDefinition = "uuid", nullable = false)
    public UUID replayedBy;

    @Column(name = "replayed_at", nullable = false)
    public Instant replayedAt;

    @Column(name = "target_topic")
    public String targetTopic;

    @Column(name = "payload_edited", nullable = false)
    public boolean payloadEdited;

    @Column(name = "failure_reason")
    public String failureReason;

    @Column(name = "attempt_count", nullable = false)
    public int attemptCount = 1;

    public static ReplayAuditRecordEntity fromDomain(ReplayAuditRecord r) {
        var e = new ReplayAuditRecordEntity();
        e.id = r.getId();
        e.messageId = r.getMessageId();
        e.replayedBy = r.getReplayedBy();
        e.replayedAt = r.getReplayedAt();
        e.targetTopic = r.getTargetTopic();
        e.payloadEdited = r.isPayloadEdited();
        e.failureReason = r.getFailureReason();
        e.attemptCount = 1;
        return e;
    }
}
