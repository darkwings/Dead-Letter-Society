package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaSecurityProtocol;

public record RegisterClusterCommand(
    String name,
    String bootstrapServers,
    KafkaSecurityProtocol securityProtocol,
    boolean tlsEnabled,
    String username,         // null unless SASL
    String password,         // null unless SASL
    String keystorePem,      // null unless SSL
    String srUrl,
    String srUsername,       // null if no SR auth
    String srPassword        // null if no SR auth
) {}
