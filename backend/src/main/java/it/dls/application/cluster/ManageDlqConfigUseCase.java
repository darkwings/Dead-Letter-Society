package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.*;
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
        dlqConfigRepo.save(config);
        return config;
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DlqConfig> listByCluster(UUID clusterId) {
        return dlqConfigRepo.findByClusterId(clusterId);
    }

    @Transactional
    public void assignUser(UUID dlqConfigId, UUID userId, DlqRole role) {
        var config = dlqConfigRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        config.assignUser(userId, role);
        dlqConfigRepo.save(config);
    }
}
