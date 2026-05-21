package it.dls.domain.message;

import java.time.Instant;
import java.util.UUID;

public class ReplayAuditRecord {

    private UUID id;
    private UUID messageId;
    private UUID replayedBy;
    private Instant replayedAt;
    private String targetTopic;
    private boolean payloadEdited;
    private String failureReason;

    private ReplayAuditRecord() {}

    public static ReplayAuditRecord success(UUID messageId, UUID replayedBy,
                                             String targetTopic, boolean payloadEdited) {
        var r = new ReplayAuditRecord();
        r.id = UUID.randomUUID();
        r.messageId = messageId;
        r.replayedBy = replayedBy;
        r.replayedAt = Instant.now();
        r.targetTopic = targetTopic;
        r.payloadEdited = payloadEdited;
        return r;
    }

    public static ReplayAuditRecord failure(UUID messageId, UUID replayedBy, String failureReason) {
        var r = new ReplayAuditRecord();
        r.id = UUID.randomUUID();
        r.messageId = messageId;
        r.replayedBy = replayedBy;
        r.replayedAt = Instant.now();
        r.payloadEdited = false;
        r.failureReason = failureReason;
        return r;
    }

    public UUID getId() { return id; }
    public UUID getMessageId() { return messageId; }
    public UUID getReplayedBy() { return replayedBy; }
    public Instant getReplayedAt() { return replayedAt; }
    public String getTargetTopic() { return targetTopic; }
    public boolean isPayloadEdited() { return payloadEdited; }
    public String getFailureReason() { return failureReason; }
}
