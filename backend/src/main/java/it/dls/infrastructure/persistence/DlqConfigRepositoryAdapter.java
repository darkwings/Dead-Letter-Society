package it.dls.infrastructure.persistence;

import it.dls.domain.dlqconfig.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class DlqConfigRepositoryAdapter implements DlqConfigRepository {

    @Override
    @Transactional
    public void save(DlqConfig config) {
        DlqConfigEntity existing = DlqConfigEntity.findById(config.getId());
        if (existing == null) {
            DlqConfigEntity.fromDomain(config).persist();
        } else {
            existing.topicName = config.getTopicName();
            existing.displayName = config.getDisplayName();
            existing.downloadMode = config.getFetchConfig().mode();
            existing.cronExpression = config.getFetchConfig().cronExpression();
            existing.batchSize = config.getFetchConfig().batchSize();
            existing.retentionType = config.getRetentionPolicy().type();
            existing.retentionValue = config.getRetentionPolicy().value();
            existing.schemaRegistryId = config.getSchemaRegistryId();
            existing.defaultReplayTopic = config.getDefaultReplayTopic();
            existing.updatedAt = Instant.now();
            syncAssignments(existing, config);
            syncPartitionOffsets(existing, config);
        }
    }

    private void syncAssignments(DlqConfigEntity entity, DlqConfig config) {
        var existingByUserId = entity.assignments.stream()
            .collect(Collectors.toMap(ae -> ae.userId, ae -> ae));
        var incomingUserIds = config.getUserAssignments().stream()
            .map(UserAssignment::userId)
            .collect(Collectors.toSet());

        for (UserAssignment a : config.getUserAssignments()) {
            if (existingByUserId.containsKey(a.userId())) {
                existingByUserId.get(a.userId()).role = a.role();
            } else {
                var ae = new DlqUserAssignmentEntity();
                ae.dlqConfig = entity;
                ae.userId = a.userId();
                ae.role = a.role();
                entity.assignments.add(ae);
            }
        }
        entity.assignments.removeIf(ae -> !incomingUserIds.contains(ae.userId));
    }

    private void syncPartitionOffsets(DlqConfigEntity entity, DlqConfig config) {
        var incomingMap = config.getPartitionOffsets().stream()
            .collect(Collectors.toMap(PartitionOffset::partition, po -> po));
        var existingMap = entity.partitionOffsets.stream()
            .collect(Collectors.toMap(e -> e.partition, e -> e));

        // update existing + add new
        for (var po : config.getPartitionOffsets()) {
            if (existingMap.containsKey(po.partition())) {
                existingMap.get(po.partition()).lastOffset = po.lastOffset();
                existingMap.get(po.partition()).updatedAt = Instant.now();
            } else {
                var pe = new PartitionOffsetEntity();
                pe.dlqConfig = entity;
                pe.partition = po.partition();
                pe.lastOffset = po.lastOffset();
                pe.updatedAt = Instant.now();
                entity.partitionOffsets.add(pe);
            }
        }
        // remove partitions no longer tracked
        entity.partitionOffsets.removeIf(pe -> !incomingMap.containsKey(pe.partition));
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<DlqConfig> findById(UUID id) {
        return DlqConfigEntity.<DlqConfigEntity>findByIdOptional(id)
            .map(DlqConfigEntity::toDomain);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> findAll() {
        return DlqConfigEntity.<DlqConfigEntity>listAll()
            .stream().map(DlqConfigEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> findByClusterId(UUID clusterId) {
        return DlqConfigEntity.<DlqConfigEntity>find("clusterId", clusterId)
            .stream().map(DlqConfigEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> findByUserId(UUID userId) {
        return DlqConfigEntity
            .<DlqConfigEntity>find(
                "SELECT DISTINCT d FROM DlqConfigEntity d JOIN d.assignments a WHERE a.userId = ?1",
                userId)
            .stream().map(DlqConfigEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> findAllWithScheduledFetch() {
        return DlqConfigEntity.<DlqConfigEntity>find(
                "downloadMode IN ?1",
                List.of(DownloadMode.SCHEDULED, DownloadMode.BOTH))
            .stream().map(DlqConfigEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        DlqConfigEntity.deleteById(id);
    }
}
