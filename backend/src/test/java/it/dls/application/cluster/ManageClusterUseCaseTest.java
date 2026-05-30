package it.dls.application.cluster;

import it.dls.domain.cluster.*;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.shared.EncryptionPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ManageClusterUseCaseTest {

    KafkaClusterRepository repo;
    DlqConfigRepository dlqConfigRepo;
    ConnectivityValidationPort connectivity;
    EncryptionPort encryption;
    ManageClusterUseCase useCase;

    @BeforeEach
    void setUp() {
        repo = mock(KafkaClusterRepository.class);
        dlqConfigRepo = mock(DlqConfigRepository.class);
        connectivity = mock(ConnectivityValidationPort.class);
        encryption = mock(EncryptionPort.class);
        useCase = new ManageClusterUseCase(repo, dlqConfigRepo, connectivity, encryption);
        when(dlqConfigRepo.findByClusterId(any())).thenReturn(List.of());
        when(encryption.encrypt(anyString())).thenAnswer(i -> "enc-" + i.getArgument(0));
        when(connectivity.testKafka(any(), any())).thenReturn(ConnectivityResult.ok());
        when(connectivity.testSchemaRegistry(any(), any())).thenReturn(ConnectivityResult.ok());
    }

    @Test
    void registerClusterSavesAndReturns() {
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
            "http://sr:8081", null, null);
        var cluster = useCase.registerCluster(cmd);
        assertThat(cluster.getId()).isNotNull();
        assertThat(cluster.getName()).isEqualTo("prod");
        verify(repo).save(cluster);
    }

    @Test
    void registerClusterEncryptsSaslCredentials() {
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.SASL_PLAIN, true, "user", "pass", null,
            "http://sr:8081", null, null);
        var cluster = useCase.registerCluster(cmd);
        assertThat(cluster.getSecurityConfig().encryptedUsername()).isEqualTo("enc-user");
        assertThat(cluster.getSecurityConfig().encryptedPassword()).isEqualTo("enc-pass");
    }

    @Test
    void registerClusterEncodesSrCredentials() {
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
            "http://sr:8081", "sr-user", "sr-pass");
        var cluster = useCase.registerCluster(cmd);
        assertThat(cluster.getSchemaRegistry().encryptedUsername()).isEqualTo("enc-sr-user");
        assertThat(cluster.getSchemaRegistry().encryptedPassword()).isEqualTo("enc-sr-pass");
    }

    @Test
    void registerClusterThrowsWhenKafkaUnreachable() {
        when(connectivity.testKafka(any(), any())).thenReturn(ConnectivityResult.fail("timeout"));
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
            "http://sr:8081", null, null);
        assertThatThrownBy(() -> useCase.registerCluster(cmd))
            .isInstanceOf(ConnectivityValidationException.class)
            .hasMessageContaining("Kafka");
    }

    @Test
    void registerClusterThrowsWhenSchemaRegistryUnreachable() {
        when(connectivity.testSchemaRegistry(any(), any())).thenReturn(ConnectivityResult.fail("refused"));
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
            "http://sr:8081", null, null);
        assertThatThrownBy(() -> useCase.registerCluster(cmd))
            .isInstanceOf(ConnectivityValidationException.class)
            .hasMessageContaining("Schema Registry");
    }

    @Test
    void deleteClusterDelegatesToRepository() {
        var id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(
            KafkaCluster.reconstitute(id, "prod", "b:9092",
                KafkaSecurityConfig.plaintext(), null)));
        useCase.deleteCluster(id);
        verify(repo).delete(id);
    }

    @Test
    void deleteClusterThrowsWhenNotFound() {
        var id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> useCase.deleteCluster(id))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void registerCluster_connectivityTestReceivesPlaintextCredentials() {
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.SASL_SCRAM_SHA_256, false, "user", "pass", null,
            null, null, null);
        useCase.registerCluster(cmd);

        var captor = ArgumentCaptor.forClass(KafkaSecurityConfig.class);
        verify(connectivity).testKafka(eq("broker:9092"), captor.capture());
        assertThat(captor.getValue().encryptedUsername()).isEqualTo("user");
        assertThat(captor.getValue().encryptedPassword()).isEqualTo("pass");
    }

    @Test
    void registerCluster_persistsEncryptedCredentials() {
        var cmd = new RegisterClusterCommand("prod", "broker:9092",
            KafkaSecurityProtocol.SASL_SCRAM_SHA_256, false, "user", "pass", null,
            null, null, null);
        var cluster = useCase.registerCluster(cmd);

        assertThat(cluster.getSecurityConfig().encryptedUsername()).isEqualTo("enc-user");
        assertThat(cluster.getSecurityConfig().encryptedPassword()).isEqualTo("enc-pass");
    }
}
