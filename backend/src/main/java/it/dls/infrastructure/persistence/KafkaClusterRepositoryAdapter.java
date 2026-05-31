package it.dls.infrastructure.persistence;

import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class KafkaClusterRepositoryAdapter implements KafkaClusterRepository {

    @Override
    @Transactional
    public void save(KafkaCluster cluster) {
        KafkaClusterEntity existing = KafkaClusterEntity.findById(cluster.getId());
        if (existing == null) {
            KafkaClusterEntity.fromDomain(cluster).persist();
        } else {
            existing.name = cluster.getName();
            existing.bootstrapServers = cluster.getBootstrapServers();
            existing.securityProtocol = cluster.getSecurityConfig().protocol();
            existing.encryptedUsername = cluster.getSecurityConfig().encryptedUsername();
            existing.encryptedPassword = cluster.getSecurityConfig().encryptedPassword();
            existing.encryptedKeystorePem = cluster.getSecurityConfig().encryptedKeystorePem();
            if (cluster.getSchemaRegistry() != null) {
                existing.srUrl = cluster.getSchemaRegistry().url();
                existing.srEncryptedUsername = cluster.getSchemaRegistry().encryptedUsername();
                existing.srEncryptedPassword = cluster.getSchemaRegistry().encryptedPassword();
            } else {
                existing.srUrl = null;
                existing.srEncryptedUsername = null;
                existing.srEncryptedPassword = null;
            }
            existing.updatedAt = Instant.now();
        }
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<KafkaCluster> findById(UUID id) {
        return KafkaClusterEntity.<KafkaClusterEntity>findByIdOptional(id)
            .map(KafkaClusterEntity::toDomain);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<KafkaCluster> findAll() {
        return KafkaClusterEntity.<KafkaClusterEntity>listAll()
            .stream().map(KafkaClusterEntity::toDomain).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        KafkaClusterEntity.deleteById(id);
    }
}
