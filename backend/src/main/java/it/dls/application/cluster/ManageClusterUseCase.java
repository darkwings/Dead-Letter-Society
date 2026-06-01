package it.dls.application.cluster;

import it.dls.domain.cluster.*;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.shared.EncryptionPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class ManageClusterUseCase {

    private final KafkaClusterRepository clusterRepo;
    private final DlqConfigRepository dlqConfigRepo;
    private final ConnectivityValidationPort connectivity;
    private final EncryptionPort encryption;

    @Inject
    public ManageClusterUseCase(KafkaClusterRepository clusterRepo,
                                DlqConfigRepository dlqConfigRepo,
                                ConnectivityValidationPort connectivity,
                                EncryptionPort encryption) {
        this.clusterRepo = clusterRepo;
        this.dlqConfigRepo = dlqConfigRepo;
        this.connectivity = connectivity;
        this.encryption = encryption;
    }

    @Transactional
    public KafkaCluster registerCluster(RegisterClusterCommand cmd) {
        var plainSecurity = buildPlainSecurityConfig(cmd);
        var kafkaResult = connectivity.testKafka(cmd.bootstrapServers(), plainSecurity);
        if (!kafkaResult.success())
            throw new ConnectivityValidationException("Kafka: " + kafkaResult.errorMessage());

        var encSecurity = buildEncryptedSecurityConfig(cmd);

        SchemaRegistryConfig srConfig = null;
        if (cmd.srUrl() != null && !cmd.srUrl().isBlank()) {
            String srUrl = normaliseSrUrl(cmd.srUrl());
            var plainSrAuth = new SchemaRegistryAuthConfig(cmd.srUsername(), cmd.srPassword(),
                cmd.srTruststorePem());
            var srResult = connectivity.testSchemaRegistry(srUrl, plainSrAuth);
            if (!srResult.success())
                throw new ConnectivityValidationException("Schema Registry: " + srResult.errorMessage());
            srConfig = new SchemaRegistryConfig(
                srUrl,
                cmd.srUsername() != null ? encryption.encrypt(cmd.srUsername()) : null,
                cmd.srPassword() != null ? encryption.encrypt(cmd.srPassword()) : null,
                cmd.srTruststorePem() != null ? encryption.encrypt(cmd.srTruststorePem()) : null);
        }

        var cluster = KafkaCluster.create(cmd.bootstrapServers(), cmd.name(), encSecurity, srConfig);
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

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<String> listTopics(UUID clusterId) {
        var cluster = clusterRepo.findById(clusterId)
            .orElseThrow(() -> new IllegalArgumentException("Cluster not found: " + clusterId));
        var decryptedSecurity = cluster.getSecurityConfig().decrypted(encryption);
        var all = connectivity.listTopics(cluster.getBootstrapServers(), decryptedSecurity);
        Set<String> configured = dlqConfigRepo.findByClusterId(clusterId).stream()
            .map(DlqConfig::getTopicName)
            .collect(Collectors.toSet());
        return all.stream().filter(t -> !configured.contains(t)).toList();
    }

    private KafkaSecurityConfig buildPlainSecurityConfig(RegisterClusterCommand cmd) {
        return switch (cmd.securityProtocol()) {
            case PLAINTEXT -> KafkaSecurityConfig.plaintext();
            case SSL -> KafkaSecurityConfig.ssl(cmd.keystorePem(), cmd.truststorePem());
            case SASL_PLAIN -> KafkaSecurityConfig.saslPlain(
                cmd.username(), cmd.password(), cmd.tlsEnabled(), cmd.truststorePem());
            case SASL_SCRAM_SHA_256 -> KafkaSecurityConfig.saslScram256(
                cmd.username(), cmd.password(), cmd.tlsEnabled(), cmd.truststorePem());
            case SASL_SCRAM_SHA_512 -> KafkaSecurityConfig.saslScram512(
                cmd.username(), cmd.password(), cmd.tlsEnabled(), cmd.truststorePem());
        };
    }

    private KafkaSecurityConfig buildEncryptedSecurityConfig(RegisterClusterCommand cmd) {
        String encTruststore = cmd.truststorePem() != null
            ? encryption.encrypt(cmd.truststorePem()) : null;
        return switch (cmd.securityProtocol()) {
            case PLAINTEXT -> KafkaSecurityConfig.plaintext();
            case SSL -> KafkaSecurityConfig.ssl(encryption.encrypt(cmd.keystorePem()), encTruststore);
            case SASL_PLAIN -> KafkaSecurityConfig.saslPlain(
                encryption.encrypt(cmd.username()),
                encryption.encrypt(cmd.password()),
                cmd.tlsEnabled(), encTruststore);
            case SASL_SCRAM_SHA_256 -> KafkaSecurityConfig.saslScram256(
                encryption.encrypt(cmd.username()),
                encryption.encrypt(cmd.password()),
                cmd.tlsEnabled(), encTruststore);
            case SASL_SCRAM_SHA_512 -> KafkaSecurityConfig.saslScram512(
                encryption.encrypt(cmd.username()),
                encryption.encrypt(cmd.password()),
                cmd.tlsEnabled(), encTruststore);
        };
    }

    private String normaliseSrUrl(String url) {
        String u = url.strip().replaceAll("/+$", "");
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
            u = "http://" + u;
        }
        return u;
    }
}
