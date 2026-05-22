package it.dls.application.inspection;

import it.dls.domain.message.*;
import it.dls.domain.shared.NotificationPort;
import it.dls.domain.user.UserRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AddNoteUseCase {

    private final NoteRepository noteRepo;
    private final MessageRepository messageRepo;
    private final UserRepository userRepo;
    private final NotificationPort notifier;

    @Inject
    public AddNoteUseCase(NoteRepository noteRepo, MessageRepository messageRepo,
                          UserRepository userRepo, NotificationPort notifier) {
        this.noteRepo = noteRepo;
        this.messageRepo = messageRepo;
        this.userRepo = userRepo;
        this.notifier = notifier;
    }

    @Transactional
    public Note addNote(UUID messageId, String content, String ticketReference, UUID authorId) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));

        if (msg.getStatus() == MessageStatus.NEW) {
            msg.transitionTo(MessageStatus.UNDER_REVIEW);
            messageRepo.save(msg);
        }

        String authorDisplayName = userRepo.findById(authorId)
            .map(u -> u.getDisplayName())
            .orElse("Unknown");

        var note = Note.create(messageId, authorId, authorDisplayName, content, ticketReference);
        noteRepo.save(note);
        notifier.emitNoteAdded(messageId, msg.getDlqConfigId());
        return note;
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<Note> listNotes(UUID messageId) {
        messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        return noteRepo.findByMessageId(messageId);
    }
}
