package it.dls.infrastructure.api.cluster;

import it.dls.domain.cluster.KafkaSecurityProtocol;

public record CreateClusterRequest(
    String name,
    String bootstrapServers,
    KafkaSecurityProtocol securityProtocol,
    Boolean tlsEnabled,
    String username,
    String password,
    String keystorePem,
    String truststorePem,
    String srUrl,
    String srUsername,
    String srPassword,
    String srTruststorePem
) {}
