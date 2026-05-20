package it.dls.infrastructure.api.cluster;

import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaSecurityProtocol;

import java.util.UUID;

public record ClusterResponse(
    UUID id,
    String name,
    String bootstrapServers,
    KafkaSecurityProtocol securityProtocol,
    boolean hasSchemaRegistry
) {
    public static ClusterResponse from(KafkaCluster c) {
        return new ClusterResponse(
            c.getId(),
            c.getName(),
            c.getBootstrapServers(),
            c.getSecurityConfig().protocol(),
            c.getSchemaRegistry() != null
        );
    }
}
