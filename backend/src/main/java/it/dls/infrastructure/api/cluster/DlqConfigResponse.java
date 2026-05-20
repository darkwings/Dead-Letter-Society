package it.dls.infrastructure.api.cluster;

import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqRole;
import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.RetentionPolicy;

import java.util.List;
import java.util.UUID;

public record DlqConfigResponse(
    UUID id,
    UUID clusterId,
    String topicName,
    String displayName,
    DownloadMode downloadMode,
    String cronExpression,
    int batchSize,
    RetentionPolicy.RetentionType retentionType,
    int retentionValue,
    UUID schemaRegistryId,
    List<UserAssignmentResponse> userAssignments
) {
    public record UserAssignmentResponse(UUID userId, DlqRole role) {}

    public static DlqConfigResponse from(DlqConfig c) {
        return new DlqConfigResponse(
            c.getId(),
            c.getClusterId(),
            c.getTopicName(),
            c.getDisplayName(),
            c.getFetchConfig().mode(),
            c.getFetchConfig().cronExpression(),
            c.getFetchConfig().batchSize(),
            c.getRetentionPolicy().type(),
            c.getRetentionPolicy().value(),
            c.getSchemaRegistryId(),
            c.getUserAssignments().stream()
                .map(a -> new UserAssignmentResponse(a.userId(), a.role()))
                .toList()
        );
    }
}
