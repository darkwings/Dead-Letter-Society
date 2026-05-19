package it.dls.application.cluster;

import it.dls.domain.cluster.*;
import it.dls.domain.shared.EncryptionPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ManageClusterUseCase {

    private final KafkaClusterRepository clusterRepo;
    private final ConnectivityValidationPort connectivity;
    private final EncryptionPort encryption;

    @Inject
    public ManageClusterUseCase(KafkaClusterRepository clusterRepo,
                                ConnectivityValidationPort connectivity,
                                EncryptionPort encryption) {
        this.clusterRepo = clusterRepo;
        this.connectivity = connectivity;
        this.encryption = encryption;
    }

    @Transactional
    public KafkaCluster registerCluster(RegisterClusterCommand cmd) {
        var security = buildSecurityConfig(cmd);
        var srConfig = new SchemaRegistryConfig(cmd.srUrl(),
            cmd.srUsername() != null ? encryption.encrypt(cmd.srUsername()) : null,
            cmd.srPassword() != null ? encryption.encrypt(cmd.srPassword()) : null);

        var kafkaResult = connectivity.testKafka(cmd.bootstrapServers(), security);
        if (!kafkaResult.success())
            throw new ConnectivityValidationException("Kafka: " + kafkaResult.errorMessage());

        var srResult = connectivity.testSchemaRegistry(cmd.srUrl(), srConfig.authConfig());
        if (!srResult.success())
            throw new ConnectivityValidationException("Schema Registry: " + srResult.errorMessage());

        var cluster = KafkaCluster.create(cmd.bootstrapServers(), cmd.name(), security, srConfig);
        clusterRepo.save(cluster);
        return cluster;
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<KafkaCluster> listClusters() {
        return clusterRepo.findAll();
    }

    @Transactional
    public void deleteCluster(UUID id) {
        clusterRepo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Cluster not found: " + id));
        clusterRepo.delete(id);
    }

    private KafkaSecurityConfig buildSecurityConfig(RegisterClusterCommand cmd) {
        return switch (cmd.securityProtocol()) {
            case PLAINTEXT -> KafkaSecurityConfig.plaintext();
            case SSL -> KafkaSecurityConfig.ssl(encryption.encrypt(cmd.keystorePem()));
            case SASL_PLAIN, SASL_SCRAM_SHA_256, SASL_SCRAM_SHA_512 ->
                new KafkaSecurityConfig(cmd.securityProtocol(),
                    encryption.encrypt(cmd.username()),
                    encryption.encrypt(cmd.password()),
                    null);
        };
    }
}
