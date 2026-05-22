package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.message.Note;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "notes")
public class NoteEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    @Column(name = "message_id", columnDefinition = "uuid")
    public UUID messageId;

    @Column(name = "author_id", columnDefinition = "uuid")
    public UUID authorId;

    @Column(name = "author_display_name")
    public String authorDisplayName;

    @Column(columnDefinition = "text")
    public String content;

    @Column(name = "ticket_reference")
    public String ticketReference;

    @Column(name = "created_at")
    public Instant createdAt;

    public static NoteEntity fromDomain(Note n) {
        var e = new NoteEntity();
        e.id = n.getId();
        e.messageId = n.getMessageId();
        e.authorId = n.getAuthorId();
        e.authorDisplayName = n.getAuthorDisplayName();
        e.content = n.getContent();
        e.ticketReference = n.getTicketReference();
        e.createdAt = n.getCreatedAt();
        return e;
    }

    public Note toDomain() {
        return Note.reconstitute(id, messageId, authorId, authorDisplayName,
                                 content, ticketReference, createdAt);
    }

    @SuppressWarnings("unchecked")
    public static List<NoteEntity> findByMessageId(UUID messageId) {
        return find("messageId", messageId).list();
    }
}
