package it.dls.application.cluster;

import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.dlqconfig.HeaderPreset;
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
    String defaultReplayTopic,
    HeaderPreset headerPreset,       // nullable → keep existing mapping
    HeaderMapping headerMapping      // only used when headerPreset == CUSTOM
) {
    public UpdateDlqConfigCommand(String displayName, DownloadMode downloadMode, String cronExpression,
                                  int batchSize, RetentionPolicy.RetentionType retentionType,
                                  int retentionValue, UUID schemaRegistryId, String defaultReplayTopic) {
        this(displayName, downloadMode, cronExpression, batchSize, retentionType,
            retentionValue, schemaRegistryId, defaultReplayTopic, null, null);
    }
}
