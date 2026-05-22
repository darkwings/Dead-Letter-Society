package it.dls.domain.message;

import java.util.List;
import java.util.UUID;

public interface NoteRepository {
    void save(Note note);
    List<Note> findByMessageId(UUID messageId);
}
