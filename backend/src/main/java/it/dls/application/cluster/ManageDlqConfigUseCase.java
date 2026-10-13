package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.*;
import java.util.Optional;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ManageDlqConfigUseCase {

    private final DlqConfigRepository dlqConfigRepo;
    private final KafkaClusterRepository clusterRepo;

    @Inject
    public ManageDlqConfigUseCase(DlqConfigRepository dlqConfigRepo, KafkaClusterRepository clusterRepo) {
        this.dlqConfigRepo = dlqConfigRepo;
        this.clusterRepo = clusterRepo;
    }

    @Transactional
    public DlqConfig createDlqConfig(UUID clusterId, CreateDlqConfigCommand cmd) {
        if (clusterRepo.findById(clusterId).isEmpty()) {
            throw new IllegalArgumentException("Cluster not found: " + clusterId);
        }
        FetchConfig fetchConfig = switch (cmd.downloadMode()) {
            case SCHEDULED -> FetchConfig.scheduled(cmd.cronExpression(), cmd.batchSize());
            case ON_DEMAND -> FetchConfig.onDemand(cmd.batchSize());
            case BOTH -> FetchConfig.both(cmd.cronExpression(), cmd.batchSize());
        };
        RetentionPolicy retentionPolicy = switch (cmd.retentionType()) {
            case MAX_AGE_DAYS -> RetentionPolicy.maxDays(cmd.retentionValue());
            case MAX_COUNT -> RetentionPolicy.maxCount(cmd.retentionValue());
        };
        var config = DlqConfig.create(clusterId, cmd.topicName(), cmd.displayName(),
            fetchConfig, retentionPolicy, cmd.schemaRegistryId());
        if (cmd.headerPreset() != null) config.changeHeaderMapping(cmd.headerPreset(), cmd.headerMapping());
        dlqConfigRepo.save(config);
        return config;
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> listByCluster(UUID clusterId) {
        return dlqConfigRepo.findByClusterId(clusterId);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<DlqConfig> findById(UUID id) {
        return dlqConfigRepo.findById(id);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> listForUser(UUID userId) {
        return dlqConfigRepo.findByUserId(userId);
    }

    @Transactional
    public DlqConfig updateDlqConfig(UUID id, UpdateDlqConfigCommand cmd) {
        var config = dlqConfigRepo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + id));
        FetchConfig fetchConfig = switch (cmd.downloadMode()) {
            case SCHEDULED -> FetchConfig.scheduled(cmd.cronExpression(), cmd.batchSize());
            case ON_DEMAND -> FetchConfig.onDemand(cmd.batchSize());
            case BOTH -> FetchConfig.both(cmd.cronExpression(), cmd.batchSize());
        };
        RetentionPolicy retentionPolicy = switch (cmd.retentionType()) {
            case MAX_AGE_DAYS -> RetentionPolicy.maxDays(cmd.retentionValue());
            case MAX_COUNT -> RetentionPolicy.maxCount(cmd.retentionValue());
        };
        config.update(cmd.displayName(), fetchConfig, retentionPolicy,
            cmd.schemaRegistryId(), cmd.defaultReplayTopic());
        if (cmd.headerPreset() != null) config.changeHeaderMapping(cmd.headerPreset(), cmd.headerMapping());
        dlqConfigRepo.save(config);
        return config;
    }

    @Transactional
    public void assignUser(UUID dlqConfigId, UUID userId, DlqRole role) {
        var config = dlqConfigRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        config.assignUser(userId, role);
        dlqConfigRepo.save(config);
    }

    @Transactional
    public void revokeUser(UUID dlqConfigId, UUID userId) {
        var config = dlqConfigRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        config.revokeUser(userId);
        dlqConfigRepo.save(config);
    }
}
