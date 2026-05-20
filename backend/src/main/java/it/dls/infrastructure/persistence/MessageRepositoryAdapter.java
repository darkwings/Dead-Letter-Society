package it.dls.infrastructure.persistence;

import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class MessageRepositoryAdapter implements MessageRepository {

    @Override
    @Transactional
    public void save(DlqMessage message) {
        DlqMessageEntity existing = DlqMessageEntity.findById(message.getId());
        if (existing == null) {
            DlqMessageEntity.fromDomain(message).persist();
        } else {
            existing.status = message.getStatus();
            existing.decodedPayload = message.getDecodedPayload();
            existing.schemaDecodeFailed = message.isSchemaDecodeFailed();
        }
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<DlqMessage> findById(UUID id) {
        return DlqMessageEntity.<DlqMessageEntity>findByIdOptional(id)
            .map(DlqMessageEntity::toDomain);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqMessage> findByDlqConfigId(UUID dlqConfigId, int page, int size) {
        return DlqMessageEntity.<DlqMessageEntity>find(
                "dlqConfigId = ?1 ORDER BY kafkaTimestamp DESC", dlqConfigId)
            .page(page, size)
            .stream()
            .map(DlqMessageEntity::toDomain)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public long countByDlqConfigId(UUID dlqConfigId) {
        return DlqMessageEntity.count("dlqConfigId", dlqConfigId);
    }
}
