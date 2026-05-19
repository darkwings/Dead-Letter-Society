package it.dls.infrastructure.persistence;

import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.DlqRole;
import it.dls.domain.dlqconfig.UserAssignment;
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
            existing.updatedAt = Instant.now();
            syncAssignments(existing, config);
        }
    }

    private void syncAssignments(DlqConfigEntity entity, DlqConfig config) {
        entity.assignments.clear();
        for (UserAssignment a : config.getUserAssignments()) {
            var ae = new DlqUserAssignmentEntity();
            ae.dlqConfig = entity;
            ae.userId = a.userId();
            ae.role = a.role();
            entity.assignments.add(ae);
        }
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<DlqConfig> findById(UUID id) {
        return DlqConfigEntity.<DlqConfigEntity>findByIdOptional(id)
            .map(DlqConfigEntity::toDomain);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> findByClusterId(UUID clusterId) {
        return DlqConfigEntity.<DlqConfigEntity>find("clusterId", clusterId)
            .stream().map(DlqConfigEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        DlqConfigEntity.deleteById(id);
    }
}
