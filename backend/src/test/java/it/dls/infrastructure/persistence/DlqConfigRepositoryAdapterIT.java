package it.dls.infrastructure.persistence;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.TestTransaction;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.*;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@QuarkusTest
class DlqConfigRepositoryAdapterIT {

    @Inject DlqConfigRepository repo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject UserRepository userRepo;

    private KafkaCluster savedCluster() {
        var c = KafkaCluster.create("localhost:9092", "test-cluster-" + UUID.randomUUID(),
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(c);
        return c;
    }

    private User savedUser() {
        var u = User.createLocal("user-" + UUID.randomUUID() + "@dls.io", "User", "hash");
        userRepo.save(u);
        return u;
    }

    @Test
    @TestTransaction
    void saveAndFindById() {
        var cluster = savedCluster();
        var config = DlqConfig.create(cluster.getId(), "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        repo.save(config);
        var found = repo.findById(config.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getTopicName()).isEqualTo("orders-dlq");
        assertThat(found.get().getDisplayName()).isEqualTo("Orders DLQ");
        assertThat(found.get().getFetchConfig().mode()).isEqualTo(DownloadMode.ON_DEMAND);
        assertThat(found.get().getRetentionPolicy().type())
            .isEqualTo(RetentionPolicy.RetentionType.MAX_AGE_DAYS);
        assertThat(found.get().getRetentionPolicy().value()).isEqualTo(30);
    }

    @Test
    @TestTransaction
    void saveScheduledFetchConfig() {
        var cluster = savedCluster();
        var config = DlqConfig.create(cluster.getId(), "events-dlq", "Events DLQ",
            FetchConfig.scheduled("0 * * * *", 100), RetentionPolicy.maxCount(5000), null);
        repo.save(config);
        var found = repo.findById(config.getId()).get();
        assertThat(found.getFetchConfig().mode()).isEqualTo(DownloadMode.SCHEDULED);
        assertThat(found.getFetchConfig().cronExpression()).isEqualTo("0 * * * *");
        assertThat(found.getFetchConfig().batchSize()).isEqualTo(100);
    }

    @Test
    @TestTransaction
    void findByClusterIdReturnsAll() {
        var cluster = savedCluster();
        repo.save(DlqConfig.create(cluster.getId(), "dlq-1", "DLQ 1",
            FetchConfig.onDemand(100), RetentionPolicy.maxDays(7), null));
        repo.save(DlqConfig.create(cluster.getId(), "dlq-2", "DLQ 2",
            FetchConfig.onDemand(200), RetentionPolicy.maxDays(14), null));
        assertThat(repo.findByClusterId(cluster.getId())).hasSize(2);
    }

    @Test
    @TestTransaction
    void deleteRemovesConfig() {
        var cluster = savedCluster();
        var config = DlqConfig.create(cluster.getId(), "temp-dlq", "Temp DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(1), null);
        repo.save(config);
        repo.delete(config.getId());
        assertThat(repo.findById(config.getId())).isEmpty();
    }

    @Test
    @TestTransaction
    void userAssignmentsPersistedAndReconstituted() {
        var cluster = savedCluster();
        var user = savedUser();
        var config = DlqConfig.create(cluster.getId(), "assign-dlq", "Assign DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(user.getId(), DlqRole.OPERATOR);
        repo.save(config);

        var found = repo.findById(config.getId()).get();
        assertThat(found.getUserAssignments()).hasSize(1);
        assertThat(found.getUserAssignments().get(0).userId()).isEqualTo(user.getId());
        assertThat(found.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
    }

    @Test
    @TestTransaction
    void resaveWithUnchangedAssignments_doesNotThrow() {
        var cluster = savedCluster();
        var user = savedUser();
        var config = DlqConfig.create(cluster.getId(), "resave-dlq", "Resave DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(user.getId(), DlqRole.OPERATOR);
        repo.save(config);

        // Simulate fetchScheduled: reload domain object, then save again (offsets only changed)
        var reloaded = repo.findById(config.getId()).get();
        assertThatCode(() -> repo.save(reloaded)).doesNotThrowAnyException();

        var found = repo.findById(config.getId()).get();
        assertThat(found.getUserAssignments()).hasSize(1);
        assertThat(found.getUserAssignments().get(0).userId()).isEqualTo(user.getId());
        assertThat(found.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
    }

    @Test
    @TestTransaction
    void removeUserAssignment_removesFromDb() {
        var cluster = savedCluster();
        var user = savedUser();
        var config = DlqConfig.create(cluster.getId(), "remove-dlq", "Remove DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(user.getId(), DlqRole.OPERATOR);
        repo.save(config);

        var reloaded = repo.findById(config.getId()).get();
        reloaded.revokeUser(user.getId());
        repo.save(reloaded);

        var found = repo.findById(config.getId()).get();
        assertThat(found.getUserAssignments()).isEmpty();
    }

    @Test
    @TestTransaction
    void updateUserAssignmentPersists() {
        var cluster = savedCluster();
        var user = savedUser();
        var config = DlqConfig.create(cluster.getId(), "update-dlq", "Update DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
        config.assignUser(user.getId(), DlqRole.VIEWER);
        repo.save(config);

        config.assignUser(user.getId(), DlqRole.OPERATOR);
        repo.save(config);

        var found = repo.findById(config.getId()).get();
        assertThat(found.getUserAssignments()).hasSize(1);
        assertThat(found.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
    }

    @Inject jakarta.persistence.EntityManager em;

    @Test
    @TestTransaction
    void headerMappingRoundTripsForEachPreset() {
        var cluster = savedCluster();
        for (var preset : new HeaderPreset[]{HeaderPreset.LEGACY, HeaderPreset.SPRING, HeaderPreset.QUARKUS_SMALLRYE}) {
            var config = DlqConfig.create(cluster.getId(), "t-" + preset, "T " + preset,
                FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
            config.changeHeaderMapping(preset, null);
            repo.save(config);
            em.flush();
            em.clear();
            var found = repo.findById(config.getId()).orElseThrow();
            assertThat(found.getHeaderPreset()).isEqualTo(preset);
            assertThat(found.getHeaderMapping()).isEqualTo(preset.mapping());
        }
    }

    @Test
    @TestTransaction
    void customHeaderMappingRoundTripsAndUpdates() {
        var cluster = savedCluster();
        var config = DlqConfig.create(cluster.getId(), "custom-dlq", "Custom",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        repo.save(config);
        var custom = new HeaderMapping(new HeaderField("my-topic", HeaderEncoding.STRING),
            new HeaderField("my-part", HeaderEncoding.INT32), null, null, null, null);
        config.changeHeaderMapping(HeaderPreset.CUSTOM, custom);
        repo.save(config);
        em.flush();
        em.clear();
        var found = repo.findById(config.getId()).orElseThrow();
        assertThat(found.getHeaderPreset()).isEqualTo(HeaderPreset.CUSTOM);
        assertThat(found.getHeaderMapping()).isEqualTo(custom);
    }

    @Test
    @TestTransaction
    void rowsInsertedWithoutMappingColumnsGetLegacyDefaults() {
        var cluster = savedCluster();
        var id = UUID.randomUUID();
        em.createNativeQuery("""
            INSERT INTO dlq_configs (id, cluster_id, topic_name, display_name, download_mode,
                batch_size, retention_type, retention_value)
            VALUES (:id, :cid, 'old-dlq', 'Old', 'ON_DEMAND', 10, 'MAX_COUNT', 10)
            """).setParameter("id", id).setParameter("cid", cluster.getId()).executeUpdate();
        em.clear();
        var found = repo.findById(id).orElseThrow();
        assertThat(found.getHeaderPreset()).isEqualTo(HeaderPreset.LEGACY);
        assertThat(found.getHeaderMapping().originalTopic().name()).isEqualTo("x-original-topic");
    }
}
