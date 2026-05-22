package it.dls.domain.cluster;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KafkaClusterRepository {
    void save(KafkaCluster cluster);
    Optional<KafkaCluster> findById(UUID id);
    List<KafkaCluster> findAll();
    void delete(UUID id);
}
