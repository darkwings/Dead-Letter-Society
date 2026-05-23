package it.dls.domain.dlqconfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class DlqConfig {

    private UUID id;
    private UUID clusterId;
    private String topicName;
    private String displayName;
    private FetchConfig fetchConfig;
    private RetentionPolicy retentionPolicy;
    private UUID schemaRegistryId;  // nullable
    private String defaultReplayTopic;  // nullable — overrides x-original-topic header
    private final List<UserAssignment> userAssignments = new ArrayList<>();
    private final List<PartitionOffset> partitionOffsets = new ArrayList<>();

    private DlqConfig() {}

    public static DlqConfig create(UUID clusterId, String topicName, String displayName,
                                   FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                                   UUID schemaRegistryId) {
        if (clusterId == null)
            throw new IllegalArgumentException("clusterId must not be null");
        if (topicName == null || topicName.isBlank())
            throw new IllegalArgumentException("topicName must not be blank");
        if (displayName == null || displayName.isBlank())
            throw new IllegalArgumentException("displayName must not be blank");
        if (fetchConfig == null)
            throw new IllegalArgumentException("fetchConfig must not be null");
        if (retentionPolicy == null)
            throw new IllegalArgumentException("retentionPolicy must not be null");
        var c = new DlqConfig();
        c.id = UUID.randomUUID();
        c.clusterId = clusterId;
        c.topicName = topicName;
        c.displayName = displayName;
        c.fetchConfig = fetchConfig;
        c.retentionPolicy = retentionPolicy;
        c.schemaRegistryId = schemaRegistryId;
        return c;
    }

    public static DlqConfig reconstitute(UUID id, UUID clusterId, String topicName, String displayName,
                                         FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                                         UUID schemaRegistryId, List<UserAssignment> assignments,
                                         List<PartitionOffset> partitionOffsets) {
        return reconstitute(id, clusterId, topicName, displayName, fetchConfig, retentionPolicy,
            schemaRegistryId, assignments, partitionOffsets, null);
    }

    public static DlqConfig reconstitute(UUID id, UUID clusterId, String topicName, String displayName,
                                         FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                                         UUID schemaRegistryId, List<UserAssignment> assignments,
                                         List<PartitionOffset> partitionOffsets,
                                         String defaultReplayTopic) {
        var c = new DlqConfig();
        c.id = id;
        c.clusterId = clusterId;
        c.topicName = topicName;
        c.displayName = displayName;
        c.fetchConfig = fetchConfig;
        c.retentionPolicy = retentionPolicy;
        c.schemaRegistryId = schemaRegistryId;
        c.defaultReplayTopic = defaultReplayTopic;
        if (assignments != null) c.userAssignments.addAll(assignments);
        if (partitionOffsets != null) c.partitionOffsets.addAll(partitionOffsets);
        return c;
    }

    public void assignUser(UUID userId, DlqRole role) {
        userAssignments.removeIf(a -> a.userId().equals(userId));
        userAssignments.add(new UserAssignment(userId, role));
    }

    public void revokeUser(UUID userId) {
        userAssignments.removeIf(a -> a.userId().equals(userId));
    }

    public void updatePartitionOffset(int partition, long lastOffset) {
        partitionOffsets.removeIf(po -> po.partition() == partition);
        partitionOffsets.add(new PartitionOffset(partition, lastOffset));
    }

    public void setDefaultReplayTopic(String topic) { this.defaultReplayTopic = topic; }

    public void update(String displayName, FetchConfig fetchConfig, RetentionPolicy retentionPolicy,
                       UUID schemaRegistryId, String defaultReplayTopic) {
        if (displayName == null || displayName.isBlank())
            throw new IllegalArgumentException("displayName must not be blank");
        if (fetchConfig == null)
            throw new IllegalArgumentException("fetchConfig must not be null");
        if (retentionPolicy == null)
            throw new IllegalArgumentException("retentionPolicy must not be null");
        this.displayName = displayName;
        this.fetchConfig = fetchConfig;
        this.retentionPolicy = retentionPolicy;
        this.schemaRegistryId = schemaRegistryId;
        this.defaultReplayTopic = defaultReplayTopic;
    }

    public UUID getId() { return id; }
    public UUID getClusterId() { return clusterId; }
    public String getTopicName() { return topicName; }
    public String getDisplayName() { return displayName; }
    public FetchConfig getFetchConfig() { return fetchConfig; }
    public RetentionPolicy getRetentionPolicy() { return retentionPolicy; }
    public UUID getSchemaRegistryId() { return schemaRegistryId; }
    public String getDefaultReplayTopic() { return defaultReplayTopic; }
    public List<UserAssignment> getUserAssignments() { return Collections.unmodifiableList(userAssignments); }
    public List<PartitionOffset> getPartitionOffsets() { return Collections.unmodifiableList(partitionOffsets); }
}
