package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;

import java.util.List;

public interface ConnectivityValidationPort {
    ConnectivityResult testKafka(String bootstrapServers, KafkaSecurityConfig security);
    ConnectivityResult testSchemaRegistry(String url, SchemaRegistryAuthConfig auth);
    List<String> listTopics(String bootstrapServers, KafkaSecurityConfig security);
}
