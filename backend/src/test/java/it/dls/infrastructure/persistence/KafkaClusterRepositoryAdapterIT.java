package it.dls.infrastructure.persistence;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.TestTransaction;
import it.dls.domain.cluster.*;
import it.dls.domain.cluster.KafkaClusterRepository;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

@QuarkusTest
class KafkaClusterRepositoryAdapterIT {

    @Inject KafkaClusterRepository repo;

    @Test
    @TestTransaction
    void saveAndFindById() {
        var cluster = KafkaCluster.create("localhost:9092", "dev",
            KafkaSecurityConfig.plaintext(),
            new SchemaRegistryConfig("http://sr:8081", null, null));
        repo.save(cluster);
        var found = repo.findById(cluster.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("dev");
        assertThat(found.get().getBootstrapServers()).isEqualTo("localhost:9092");
        assertThat(found.get().getSecurityConfig().protocol()).isEqualTo(KafkaSecurityProtocol.PLAINTEXT);
        assertThat(found.get().getSchemaRegistry()).isNotNull();
        assertThat(found.get().getSchemaRegistry().url()).isEqualTo("http://sr:8081");
    }

    @Test
    @TestTransaction
    void saveAndFindByIdNoSchemaRegistry() {
        var cluster = KafkaCluster.create("broker:9092", "no-sr",
            KafkaSecurityConfig.plaintext(), null);
        repo.save(cluster);
        var found = repo.findById(cluster.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getSchemaRegistry()).isNull();
    }

    @Test
    @TestTransaction
    void findAllReturnsAllSaved() {
        repo.save(KafkaCluster.create("b1:9092", "c1", KafkaSecurityConfig.plaintext(), null));
        repo.save(KafkaCluster.create("b2:9092", "c2", KafkaSecurityConfig.plaintext(), null));
        assertThat(repo.findAll()).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    @TestTransaction
    void deleteRemovesCluster() {
        var cluster = KafkaCluster.create("localhost:9092", "to-delete",
            KafkaSecurityConfig.plaintext(), null);
        repo.save(cluster);
        repo.delete(cluster.getId());
        assertThat(repo.findById(cluster.getId())).isEmpty();
    }

    @Test
    @TestTransaction
    void updateNamePersists() {
        var cluster = KafkaCluster.create("localhost:9092", "old-name",
            KafkaSecurityConfig.plaintext(), null);
        repo.save(cluster);
        cluster.updateName("new-name");
        repo.save(cluster);
        var found = repo.findById(cluster.getId());
        assertThat(found.get().getName()).isEqualTo("new-name");
    }

    @Test
    @TestTransaction
    void saslClusterRoundTrip() {
        var cluster = KafkaCluster.create("broker:9092", "sasl-cluster",
            KafkaSecurityConfig.saslPlain("enc-user", "enc-pass"), null);
        repo.save(cluster);
        var found = repo.findById(cluster.getId()).get();
        assertThat(found.getSecurityConfig().protocol()).isEqualTo(KafkaSecurityProtocol.SASL_PLAIN);
        assertThat(found.getSecurityConfig().encryptedUsername()).isEqualTo("enc-user");
        assertThat(found.getSecurityConfig().encryptedPassword()).isEqualTo("enc-pass");
    }
}
