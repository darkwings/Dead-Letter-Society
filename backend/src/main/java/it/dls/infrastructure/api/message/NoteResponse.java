package it.dls.infrastructure.api.message;

import it.dls.domain.message.Note;

import java.time.Instant;
import java.util.UUID;

public record NoteResponse(
    UUID id,
    UUID messageId,
    UUID authorId,
    String authorDisplayName,
    String content,
    String ticketReference,
    Instant createdAt
) {
    public static NoteResponse from(Note n) {
        return new NoteResponse(n.getId(), n.getMessageId(), n.getAuthorId(),
            n.getAuthorDisplayName(), n.getContent(), n.getTicketReference(), n.getCreatedAt());
    }
}
