package it.dls.infrastructure.persistence;

import it.dls.domain.message.Note;
import it.dls.domain.message.NoteRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class NoteRepositoryAdapter implements NoteRepository {

    @Override
    @Transactional
    public void save(Note note) {
        NoteEntity.fromDomain(note).persist();
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<Note> findByMessageId(UUID messageId) {
        return NoteEntity.findByMessageId(messageId).stream()
            .map(NoteEntity::toDomain)
            .toList();
    }
}
