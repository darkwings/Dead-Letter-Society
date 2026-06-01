package it.dls.infrastructure.kafka;

import io.quarkus.test.junit.QuarkusTest;
import it.dls.application.cluster.ConnectivityValidationPort;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class KafkaConnectivityAdapterIT {

    @Inject
    ConnectivityValidationPort connectivity;

    @Inject
    @ConfigProperty(name = "kafka.bootstrap.servers")
    String bootstrapServers;

    @Test
    void testKafkaConnectionWithDevServices() {
        var result = connectivity.testKafka(bootstrapServers, KafkaSecurityConfig.plaintext());
        assertThat(result.success()).isTrue();
        assertThat(result.errorMessage()).isNull();
    }

    @Test
    void testUnreachableKafkaReturnsFailure() {
        var result = connectivity.testKafka("localhost:9999", KafkaSecurityConfig.plaintext());
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).isNotBlank();
    }

    // Run with: ./gradlew test -Dsasl.test.enabled=true
    // Requires: docker compose -f docker/docker-compose.sasl-test.yml up -d

    @Test
    @EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
    void testKafka_saslScram256_saslPlaintext_succeeds() {
        var security = KafkaSecurityConfig.saslScram256("admin", "admin-secret", false, null);
        var result = connectivity.testKafka("localhost:19092", security);
        assertThat(result.success()).isTrue();
    }

    @Test
    @EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
    void testKafka_saslScram256_wrongPassword_fails() {
        var security = KafkaSecurityConfig.saslScram256("admin", "wrong-password", false, null);
        var result = connectivity.testKafka("localhost:19092", security);
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).isNotBlank();
    }

    @Test
    @EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
    void testSchemaRegistry_basicAuth_succeeds() {
        var auth = new SchemaRegistryAuthConfig("sr-reader", "sr-reader-secret", null);
        var result = connectivity.testSchemaRegistry("http://localhost:18081", auth);
        assertThat(result.success()).isTrue();
    }

    @Test
    @EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
    void testSchemaRegistry_wrongPassword_fails() {
        var auth = new SchemaRegistryAuthConfig("sr-reader", "wrong-password", null);
        var result = connectivity.testSchemaRegistry("http://localhost:18081", auth);
        assertThat(result.success()).isFalse();
    }
}
