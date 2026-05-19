package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;

public interface ConnectivityValidationPort {
    ConnectivityResult testKafka(String bootstrapServers, KafkaSecurityConfig security);
    ConnectivityResult testSchemaRegistry(String url, SchemaRegistryAuthConfig auth);
}
