package it.dls.domain.cluster;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class KafkaClusterTest {

    @Test
    void clusterRequiresBootstrapServers() {
        assertThatThrownBy(() ->
            KafkaCluster.create(null, "prod", KafkaSecurityConfig.plaintext(), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("bootstrapServers");
    }

    @Test
    void blankBootstrapServersRejected() {
        assertThatThrownBy(() ->
            KafkaCluster.create("  ", "prod", KafkaSecurityConfig.plaintext(), null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void clusterRequiresName() {
        assertThatThrownBy(() ->
            KafkaCluster.create("localhost:9092", null, KafkaSecurityConfig.plaintext(), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("name");
    }

    @Test
    void clusterRequiresSecurityConfig() {
        assertThatThrownBy(() ->
            KafkaCluster.create("localhost:9092", "prod", null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("securityConfig");
    }

    @Test
    void createPlaintextClusterWithoutSchemaRegistry() {
        var cluster = KafkaCluster.create(
            "localhost:9092", "dev",
            KafkaSecurityConfig.plaintext(), null);
        assertThat(cluster.getId()).isNotNull();
        assertThat(cluster.getName()).isEqualTo("dev");
        assertThat(cluster.getBootstrapServers()).isEqualTo("localhost:9092");
        assertThat(cluster.getSecurityConfig().protocol()).isEqualTo(KafkaSecurityProtocol.PLAINTEXT);
        assertThat(cluster.getSchemaRegistry()).isNull();
    }

    @Test
    void createClusterWithSchemaRegistry() {
        var sr = new SchemaRegistryConfig("http://sr:8081", null, null);
        var cluster = KafkaCluster.create(
            "localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), sr);
        assertThat(cluster.getSchemaRegistry()).isNotNull();
        assertThat(cluster.getSchemaRegistry().url()).isEqualTo("http://sr:8081");
    }

    @Test
    void schemaRegistryAuthConfigNoCredentials() {
        var sr = new SchemaRegistryConfig("http://sr:8081", null, null);
        assertThat(sr.authConfig().hasCredentials()).isFalse();
    }

    @Test
    void schemaRegistryAuthConfigWithCredentials() {
        var sr = new SchemaRegistryConfig("http://sr:8081", "enc-user", "enc-pass");
        assertThat(sr.authConfig().hasCredentials()).isTrue();
        assertThat(sr.authConfig().encryptedUsername()).isEqualTo("enc-user");
    }

    @Test
    void updateNameRejectedWhenBlank() {
        var cluster = KafkaCluster.create("localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), null);
        assertThatThrownBy(() -> cluster.updateName(""))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateBootstrapServersAppliesValue() {
        var cluster = KafkaCluster.create("localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), null);
        cluster.updateBootstrapServers("broker1:9092,broker2:9092");
        assertThat(cluster.getBootstrapServers()).isEqualTo("broker1:9092,broker2:9092");
    }

    @Test
    void updateBootstrapServersRejectedWhenBlank() {
        var cluster = KafkaCluster.create("localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), null);
        assertThatThrownBy(() -> cluster.updateBootstrapServers("  "))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateSecurityConfigAppliesValue() {
        var cluster = KafkaCluster.create("localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), null);
        var sasl = KafkaSecurityConfig.saslPlain("enc-user", "enc-pass", true);
        cluster.updateSecurityConfig(sasl);
        assertThat(cluster.getSecurityConfig().protocol()).isEqualTo(KafkaSecurityProtocol.SASL_PLAIN);
    }

    @Test
    void updateSecurityConfigRejectedWhenNull() {
        var cluster = KafkaCluster.create("localhost:9092", "prod",
            KafkaSecurityConfig.plaintext(), null);
        assertThatThrownBy(() -> cluster.updateSecurityConfig(null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void saslSecurityConfigRequiresCredentials() {
        assertThatThrownBy(() ->
            new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN, false, null, null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void schemaRegistryRequiresUrl() {
        assertThatThrownBy(() -> new SchemaRegistryConfig(null, null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void saslScram256Config_stores_tlsEnabled() {
        var config = KafkaSecurityConfig.saslScram256("enc-user", "enc-pass", false);
        assertThat(config.tlsEnabled()).isFalse();
        assertThat(config.protocol()).isEqualTo(KafkaSecurityProtocol.SASL_SCRAM_SHA_256);

        var configTls = KafkaSecurityConfig.saslScram256("enc-user", "enc-pass", true);
        assertThat(configTls.tlsEnabled()).isTrue();
    }
}
