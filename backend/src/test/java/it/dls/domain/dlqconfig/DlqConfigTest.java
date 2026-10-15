package it.dls.domain.dlqconfig;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class DlqConfigTest {

    private final UUID clusterId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    // FetchConfig validation

    @Test
    void scheduledModeRequiresCronExpression() {
        assertThatThrownBy(() -> FetchConfig.scheduled(null, 500))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("cronExpression");
    }

    @Test
    void scheduledModeRejectsBlankCron() {
        assertThatThrownBy(() -> FetchConfig.scheduled("  ", 500))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("cronExpression");
    }

    @Test
    void bothModeRequiresCronExpression() {
        assertThatThrownBy(() -> FetchConfig.both(null, 500))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("cronExpression");
    }

    @Test
    void onDemandModeHasNoCron() {
        var config = FetchConfig.onDemand(500);
        assertThat(config.mode()).isEqualTo(DownloadMode.ON_DEMAND);
        assertThat(config.cronExpression()).isNull();
        assertThat(config.batchSize()).isEqualTo(500);
    }

    @Test
    void scheduledFetchConfigHasCronAndMode() {
        var config = FetchConfig.scheduled("0 * * * *", 100);
        assertThat(config.mode()).isEqualTo(DownloadMode.SCHEDULED);
        assertThat(config.cronExpression()).isEqualTo("0 * * * *");
        assertThat(config.batchSize()).isEqualTo(100);
    }

    @Test
    void bothFetchConfigHasCronAndMode() {
        var config = FetchConfig.both("0 * * * *", 200);
        assertThat(config.mode()).isEqualTo(DownloadMode.BOTH);
        assertThat(config.cronExpression()).isEqualTo("0 * * * *");
    }

    // RetentionPolicy

    @Test
    void retentionPolicyMaxDays() {
        var policy = RetentionPolicy.maxDays(30);
        assertThat(policy.type()).isEqualTo(RetentionPolicy.RetentionType.MAX_AGE_DAYS);
        assertThat(policy.value()).isEqualTo(30);
    }

    @Test
    void retentionPolicyMaxCount() {
        var policy = RetentionPolicy.maxCount(1000);
        assertThat(policy.type()).isEqualTo(RetentionPolicy.RetentionType.MAX_COUNT);
        assertThat(policy.value()).isEqualTo(1000);
    }

    // DlqConfig creation

    @Test
    void createRequiresClusterId() {
        assertThatThrownBy(() -> DlqConfig.create(null, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("clusterId");
    }

    @Test
    void createRequiresTopicName() {
        assertThatThrownBy(() -> DlqConfig.create(clusterId, null, "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("topicName");
    }

    @Test
    void createRequiresDisplayName() {
        assertThatThrownBy(() -> DlqConfig.create(clusterId, "orders-dlq", null,
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("displayName");
    }

    @Test
    void createRequiresFetchConfig() {
        assertThatThrownBy(() -> DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            null, RetentionPolicy.maxDays(30), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("fetchConfig");
    }

    @Test
    void createRequiresRetentionPolicy() {
        assertThatThrownBy(() -> DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("retentionPolicy");
    }

    @Test
    void createDlqConfigSucceeds() {
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        assertThat(config.getId()).isNotNull();
        assertThat(config.getClusterId()).isEqualTo(clusterId);
        assertThat(config.getTopicName()).isEqualTo("orders-dlq");
        assertThat(config.getDisplayName()).isEqualTo("Orders DLQ");
        assertThat(config.getUserAssignments()).isEmpty();
        assertThat(config.getSchemaRegistryId()).isNull();
    }

    // User assignment

    @Test
    void assignUserWithRole() {
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(userId, DlqRole.OPERATOR);
        assertThat(config.getUserAssignments()).hasSize(1);
        assertThat(config.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
        assertThat(config.getUserAssignments().get(0).userId()).isEqualTo(userId);
    }

    @Test
    void assignUserReplacesExistingRole() {
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(userId, DlqRole.VIEWER);
        config.assignUser(userId, DlqRole.OPERATOR);
        assertThat(config.getUserAssignments()).hasSize(1);
        assertThat(config.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
    }

    @Test
    void revokeUserRemovesAssignment() {
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(userId, DlqRole.VIEWER);
        config.revokeUser(userId);
        assertThat(config.getUserAssignments()).isEmpty();
    }

    @Test
    void revokeUserIdempotentWhenNotAssigned() {
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        assertThatNoException().isThrownBy(() -> config.revokeUser(userId));
    }

    @Test
    void multipleUsersCanBeAssigned() {
        var other = UUID.randomUUID();
        var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(userId, DlqRole.OPERATOR);
        config.assignUser(other, DlqRole.VIEWER);
        assertThat(config.getUserAssignments()).hasSize(2);
    }

    // Header mapping

    private DlqConfig newConfig() {
        return DlqConfig.create(clusterId, "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
    }

    @Test
    void newConfigDefaultsToLegacyHeaderMapping() {
        var c = newConfig();
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.LEGACY);
        assertThat(c.getHeaderMapping()).isEqualTo(HeaderPreset.LEGACY.mapping());
    }

    @Test
    void changeHeaderMappingWithPresetIgnoresCustom() {
        var c = newConfig();
        c.changeHeaderMapping(HeaderPreset.SPRING, HeaderMapping.empty());
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.SPRING);
        assertThat(c.getHeaderMapping()).isEqualTo(HeaderPreset.SPRING.mapping());
    }

    @Test
    void changeHeaderMappingCustomUsesProvidedMapping() {
        var c = newConfig();
        var custom = new HeaderMapping(new HeaderField("my-topic", HeaderEncoding.STRING),
            null, null, null, null, null);
        c.changeHeaderMapping(HeaderPreset.CUSTOM, custom);
        assertThat(c.getHeaderPreset()).isEqualTo(HeaderPreset.CUSTOM);
        assertThat(c.getHeaderMapping()).isEqualTo(custom);
    }

    @Test
    void changeHeaderMappingCustomWithoutMappingFails() {
        var c = newConfig();
        assertThatThrownBy(() -> c.changeHeaderMapping(HeaderPreset.CUSTOM, null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> c.changeHeaderMapping(null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
