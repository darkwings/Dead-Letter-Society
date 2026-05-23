package it.dls.application.cluster;

import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.RetentionPolicy;
import java.util.UUID;

public record UpdateDlqConfigCommand(
    String displayName,
    DownloadMode downloadMode,
    String cronExpression,
    int batchSize,
    RetentionPolicy.RetentionType retentionType,
    int retentionValue,
    UUID schemaRegistryId,
    String defaultReplayTopic
) {}
