package it.dls.infrastructure.persistence;

import it.dls.domain.message.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class MessageRepositoryAdapter implements MessageRepository {

    @Inject
    EntityManager em;

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
    public MessagePage findByConfig(UUID dlqConfigId, MessageFilter f, Pageable p) {
        var base = new StringBuilder("dlqConfigId = :dlqConfigId");
        var params = new HashMap<String, Object>();
        params.put("dlqConfigId", dlqConfigId);

        if (f.status() != null) {
            base.append(" AND status = :status");
            params.put("status", f.status());
        }
        if (f.timestampFrom() != null) {
            base.append(" AND kafkaTimestamp >= :tsFrom");
            params.put("tsFrom", f.timestampFrom());
        }
        if (f.timestampTo() != null) {
            base.append(" AND kafkaTimestamp <= :tsTo");
            params.put("tsTo", f.timestampTo());
        }
        if (f.partition() != null) {
            base.append(" AND partition = :partition");
            params.put("partition", f.partition());
        }
        if (f.offsetFrom() != null) {
            base.append(" AND kafkaOffset >= :offsetFrom");
            params.put("offsetFrom", f.offsetFrom());
        }
        if (f.offsetTo() != null) {
            base.append(" AND kafkaOffset <= :offsetTo");
            params.put("offsetTo", f.offsetTo());
        }

        String baseQuery = base.toString();
        long total = DlqMessageEntity.count(baseQuery, params);
        List<DlqMessage> messages = DlqMessageEntity
            .<DlqMessageEntity>find(baseQuery + " ORDER BY kafkaTimestamp DESC", params)
            .page(p.page(), p.size())
            .stream()
            .map(DlqMessageEntity::toDomain)
            .toList();
        return new MessagePage(messages, total, p.page(), p.size());
    }

    @Override
    @Transactional
    public void deleteOlderThan(UUID dlqConfigId, Instant cutoff) {
        DlqMessageEntity.delete("dlqConfigId = ?1 AND kafkaTimestamp < ?2", dlqConfigId, cutoff);
    }

    @Override
    @Transactional
    public void deleteExceedingCount(UUID dlqConfigId, int maxCount) {
        if (maxCount <= 0) {
            DlqMessageEntity.delete("dlqConfigId", dlqConfigId);
            return;
        }
        em.createNativeQuery("""
            DELETE FROM dlq_messages
            WHERE dlq_config_id = :configId
              AND id NOT IN (
                  SELECT sub.id FROM (
                      SELECT id FROM dlq_messages
                      WHERE dlq_config_id = :configId
                      ORDER BY ingested_at DESC
                      LIMIT :maxCount
                  ) sub
              )
            """)
            .setParameter("configId", dlqConfigId)
            .setParameter("maxCount", maxCount)
            .executeUpdate();
    }
}
