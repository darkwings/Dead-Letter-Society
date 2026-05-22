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
}
