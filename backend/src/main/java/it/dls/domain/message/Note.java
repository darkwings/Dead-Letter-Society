package it.dls.domain.message;

import java.time.Instant;
import java.util.UUID;

public class Note {

    private UUID id;
    private UUID messageId;
    private UUID authorId;
    private String authorDisplayName;
    private String content;
    private String ticketReference;
    private Instant createdAt;

    private Note() {}

    public static Note create(UUID messageId, UUID authorId, String authorDisplayName,
                              String content, String ticketReference) {
        if (messageId == null) throw new IllegalArgumentException("messageId required");
        if (authorId == null) throw new IllegalArgumentException("authorId required");
        if (content == null || content.isBlank()) throw new IllegalArgumentException("content required");
        var n = new Note();
        n.id = UUID.randomUUID();
        n.messageId = messageId;
        n.authorId = authorId;
        n.authorDisplayName = authorDisplayName != null ? authorDisplayName : "Unknown";
        n.content = content;
        n.ticketReference = ticketReference;
        n.createdAt = Instant.now();
        return n;
    }

    public static Note reconstitute(UUID id, UUID messageId, UUID authorId, String authorDisplayName,
                                    String content, String ticketReference, Instant createdAt) {
        var n = new Note();
        n.id = id;
        n.messageId = messageId;
        n.authorId = authorId;
        n.authorDisplayName = authorDisplayName;
        n.content = content;
        n.ticketReference = ticketReference;
        n.createdAt = createdAt;
        return n;
    }

    public UUID getId() { return id; }
    public UUID getMessageId() { return messageId; }
    public UUID getAuthorId() { return authorId; }
    public String getAuthorDisplayName() { return authorDisplayName; }
    public String getContent() { return content; }
    public String getTicketReference() { return ticketReference; }
    public Instant getCreatedAt() { return createdAt; }
}
