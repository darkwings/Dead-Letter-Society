package it.dls.infrastructure.kafka;

import io.quarkus.test.junit.QuarkusTest;
import it.dls.application.cluster.ConnectivityValidationPort;
import it.dls.domain.cluster.KafkaSecurityConfig;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.Test;

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
}
