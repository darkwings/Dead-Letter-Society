package it.dls.infrastructure.api.cluster;

import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.RetentionPolicy;
import java.util.UUID;

public record UpdateDlqConfigRequest(
    String displayName,
    DownloadMode downloadMode,
    String cronExpression,
    int batchSize,
    RetentionPolicy.RetentionType retentionType,
    int retentionValue,
    UUID schemaRegistryId,
    String defaultReplayTopic
) {}
