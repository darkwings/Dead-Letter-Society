package it.dls.application.inspection;

import it.dls.domain.message.*;
import it.dls.domain.shared.NotificationPort;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.mockito.ArgumentCaptor;

/**
 * NOTE-001: Adding a note on a NEW message transitions it to UNDER_REVIEW.
 * NOTE-002: Adding a note on non-NEW message does not re-transition.
 * NOTE-003: Message not found throws IllegalArgumentException.
 * NOTE-004: Note saved and SSE emitted on success.
 * NOTE-005: listNotes returns empty list when no notes.
 */
class AddNoteUseCaseTest {

    NoteRepository noteRepo = mock(NoteRepository.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    UserRepository userRepo = mock(UserRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);
    AddNoteUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new AddNoteUseCase(noteRepo, messageRepo, userRepo, notifier);
    }

    @Test
    void transitions_NEW_to_UNDER_REVIEW_on_first_note() {
        var msgId = UUID.randomUUID();
        var dlqConfigId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.NEW);
        var authorId = UUID.randomUUID();
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(userRepo.findById(authorId)).thenReturn(Optional.empty());

        useCase.addNote(msgId, "content", null, authorId);

        assertThat(msg.getStatus()).isEqualTo(MessageStatus.UNDER_REVIEW);
        verify(messageRepo).save(msg);
    }

    @Test
    void does_not_re_transition_if_already_UNDER_REVIEW() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, UUID.randomUUID(), MessageStatus.UNDER_REVIEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(userRepo.findById(any())).thenReturn(Optional.empty());

        useCase.addNote(msgId, "content", null, UUID.randomUUID());

        verify(messageRepo, never()).save(any());
        assertThat(msg.getStatus()).isEqualTo(MessageStatus.UNDER_REVIEW);
    }

    @Test
    void throws_when_message_not_found() {
        var msgId = UUID.randomUUID();
        when(messageRepo.findById(msgId)).thenReturn(Optional.empty());

        assertThatIllegalArgumentException()
            .isThrownBy(() -> useCase.addNote(msgId, "content", null, UUID.randomUUID()))
            .withMessageContaining(msgId.toString());
    }

    @Test
    void saves_note_and_emits_sse() {
        var msgId = UUID.randomUUID();
        var dlqConfigId = UUID.randomUUID();
        var authorId = UUID.randomUUID();
        var msg = message(msgId, dlqConfigId, MessageStatus.UNDER_REVIEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(userRepo.findById(authorId)).thenReturn(Optional.empty());

        useCase.addNote(msgId, "investigating", "JIRA-123", authorId);

        var captor = ArgumentCaptor.forClass(Note.class);
        verify(noteRepo).save(captor.capture());
        var saved = captor.getValue();
        assertThat(saved.getMessageId()).isEqualTo(msgId);
        assertThat(saved.getContent()).isEqualTo("investigating");
        assertThat(saved.getTicketReference()).isEqualTo("JIRA-123");
        verify(notifier).emitNoteAdded(msgId, dlqConfigId);
    }

    @Test
    void author_display_name_resolved_from_user_repo() {
        var msgId = UUID.randomUUID();
        var authorId = UUID.randomUUID();
        var msg = message(msgId, UUID.randomUUID(), MessageStatus.UNDER_REVIEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        User author = mock(User.class);
        when(author.getDisplayName()).thenReturn("Alice");
        when(userRepo.findById(authorId)).thenReturn(Optional.of(author));

        var note = useCase.addNote(msgId, "content", null, authorId);

        assertThat(note.getAuthorDisplayName()).isEqualTo("Alice");
    }

    @Test
    void listNotes_throws_when_message_not_found() {
        var msgId = UUID.randomUUID();
        when(messageRepo.findById(msgId)).thenReturn(Optional.empty());

        assertThatIllegalArgumentException()
            .isThrownBy(() -> useCase.listNotes(msgId));
    }

    @Test
    void listNotes_returns_notes_for_message() {
        var msgId = UUID.randomUUID();
        var msg = message(msgId, UUID.randomUUID(), MessageStatus.UNDER_REVIEW);
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(noteRepo.findByMessageId(msgId)).thenReturn(List.of());

        var result = useCase.listNotes(msgId);

        assertThat(result).isEmpty();
    }

    private DlqMessage message(UUID id, UUID dlqConfigId, MessageStatus status) {
        return DlqMessage.reconstitute(id, dlqConfigId, 0, 0L, Instant.now(),
            new byte[]{}, new byte[]{1}, null, null, null, status, false, Instant.now(),
            null, null);
    }
}
