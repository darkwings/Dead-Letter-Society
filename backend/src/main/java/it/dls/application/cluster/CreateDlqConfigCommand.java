package it.dls.application.cluster;

import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.dlqconfig.HeaderPreset;
import it.dls.domain.dlqconfig.RetentionPolicy;

import java.util.UUID;

public record CreateDlqConfigCommand(
    String topicName,
    String displayName,
    DownloadMode downloadMode,
    String cronExpression,
    int batchSize,
    RetentionPolicy.RetentionType retentionType,
    int retentionValue,
    UUID schemaRegistryId,
    HeaderPreset headerPreset,       // nullable → LEGACY
    HeaderMapping headerMapping      // only used when headerPreset == CUSTOM
) {
    public CreateDlqConfigCommand(String topicName, String displayName, DownloadMode downloadMode,
                                  String cronExpression, int batchSize,
                                  RetentionPolicy.RetentionType retentionType, int retentionValue,
                                  UUID schemaRegistryId) {
        this(topicName, displayName, downloadMode, cronExpression, batchSize,
            retentionType, retentionValue, schemaRegistryId, null, null);
    }
}
