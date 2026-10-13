package it.dls.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.dlqconfig.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "dlq_configs")
public class DlqConfigEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    @Column(name = "cluster_id", columnDefinition = "uuid")
    public UUID clusterId;

    @Column(name = "topic_name")
    public String topicName;

    @Column(name = "display_name")
    public String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "download_mode")
    public DownloadMode downloadMode;

    @Column(name = "cron_expression")
    public String cronExpression;

    @Column(name = "batch_size")
    public int batchSize;

    @Enumerated(EnumType.STRING)
    @Column(name = "retention_type")
    public RetentionPolicy.RetentionType retentionType;

    @Column(name = "retention_value")
    public int retentionValue;

    @Column(name = "schema_registry_id", columnDefinition = "uuid")
    public UUID schemaRegistryId;

    @Column(name = "default_replay_topic")
    public String defaultReplayTopic;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Enumerated(EnumType.STRING)
    @Column(name = "header_preset")
    public HeaderPreset headerPreset = HeaderPreset.LEGACY;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "header_mapping", columnDefinition = "jsonb")
    public JsonNode headerMapping;

    @Column(name = "created_at")
    public Instant createdAt;

    @Column(name = "updated_at")
    public Instant updatedAt;

    @OneToMany(mappedBy = "dlqConfig", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    public List<DlqUserAssignmentEntity> assignments = new ArrayList<>();

    @OneToMany(mappedBy = "dlqConfig", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    public List<PartitionOffsetEntity> partitionOffsets = new ArrayList<>();

    public static DlqConfigEntity fromDomain(DlqConfig c) {
        var e = new DlqConfigEntity();
        e.id = c.getId();
        e.clusterId = c.getClusterId();
        e.topicName = c.getTopicName();
        e.displayName = c.getDisplayName();
        e.downloadMode = c.getFetchConfig().mode();
        e.cronExpression = c.getFetchConfig().cronExpression();
        e.batchSize = c.getFetchConfig().batchSize();
        e.retentionType = c.getRetentionPolicy().type();
        e.retentionValue = c.getRetentionPolicy().value();
        e.schemaRegistryId = c.getSchemaRegistryId();
        e.defaultReplayTopic = c.getDefaultReplayTopic();
        e.headerPreset = c.getHeaderPreset();
        e.headerMapping = mappingToJson(c.getHeaderMapping());
        e.createdAt = Instant.now();
        e.updatedAt = Instant.now();
        for (var a : c.getUserAssignments()) {
            var ae = new DlqUserAssignmentEntity();
            ae.dlqConfig = e;
            ae.userId = a.userId();
            ae.role = a.role();
            e.assignments.add(ae);
        }
        return e;
    }

    public DlqConfig toDomain() {
        FetchConfig fetch = switch (downloadMode) {
            case SCHEDULED -> FetchConfig.scheduled(cronExpression, batchSize);
            case ON_DEMAND -> FetchConfig.onDemand(batchSize);
            case BOTH -> FetchConfig.both(cronExpression, batchSize);
        };
        var retention = new RetentionPolicy(retentionType, retentionValue);
        var userAssignments = assignments.stream()
            .map(a -> new UserAssignment(a.userId, a.role))
            .collect(Collectors.toList());
        var offsets = partitionOffsets.stream()
            .map(PartitionOffsetEntity::toDomain)
            .collect(Collectors.toList());
        return DlqConfig.reconstitute(id, clusterId, topicName, displayName,
            fetch, retention, schemaRegistryId, userAssignments, offsets, defaultReplayTopic,
            headerPreset, headerMapping == null ? null : mappingFromJson(headerMapping));
    }

    public static JsonNode mappingToJson(HeaderMapping m) { return MAPPER.valueToTree(m); }

    private static HeaderMapping mappingFromJson(JsonNode n) {
        try {
            return MAPPER.treeToValue(n, HeaderMapping.class);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid header_mapping JSON", e);
        }
    }
}
