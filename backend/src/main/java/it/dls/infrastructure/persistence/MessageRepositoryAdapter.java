package it.dls.infrastructure.persistence;

import it.dls.application.dashboard.SparklinePoint;
import it.dls.domain.message.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

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
    @Transactional(Transactional.TxType.SUPPORTS)
    public MessagePage findAll(MessageStatus statusFilter, Pageable p, List<UUID> accessibleConfigIds) {
        if (accessibleConfigIds.isEmpty()) {
            return new MessagePage(List.of(), 0, p.page(), p.size());
        }
        var base = new StringBuilder("dlqConfigId IN :ids");
        var params = new HashMap<String, Object>();
        params.put("ids", accessibleConfigIds);
        if (statusFilter != null) {
            base.append(" AND status = :status");
            params.put("status", statusFilter);
        }
        String q = base.toString();
        long total = DlqMessageEntity.count(q, params);
        List<DlqMessage> messages = DlqMessageEntity
            .<DlqMessageEntity>find(q + " ORDER BY kafkaTimestamp DESC", params)
            .page(p.page(), p.size())
            .stream()
            .map(DlqMessageEntity::toDomain)
            .toList();
        return new MessagePage(messages, total, p.page(), p.size());
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public long countByStatus(MessageStatus status) {
        return DlqMessageEntity.count("status", status);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<SparklinePoint> getSparklineData(int days) {
        Instant cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(days - 1)
            .atStartOfDay().toInstant(ZoneOffset.UTC);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
            SELECT
                DATE_TRUNC('day', ingested_at AT TIME ZONE 'UTC') AS day,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'REPLAYED') AS replayed
            FROM dlq_messages
            WHERE ingested_at >= :cutoff
            GROUP BY day
            ORDER BY day
            """)
            .setParameter("cutoff", cutoff)
            .getResultList();

        Map<LocalDate, long[]> byDay = rows.stream().collect(Collectors.toMap(
            r -> ((java.sql.Timestamp) r[0]).toLocalDateTime().toLocalDate(),
            r -> new long[]{ ((Number) r[2]).longValue(), ((Number) r[1]).longValue() }
        ));

        return LocalDate.now(ZoneOffset.UTC).minusDays(days - 1)
            .datesUntil(LocalDate.now(ZoneOffset.UTC).plusDays(1))
            .map(date -> {
                long[] vals = byDay.getOrDefault(date, new long[]{0, 0});
                return new SparklinePoint(date, vals[0], vals[1]);
            })
            .toList();
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
