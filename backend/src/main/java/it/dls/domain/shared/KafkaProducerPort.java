package it.dls.domain.shared;

import it.dls.domain.cluster.KafkaSecurityConfig;

import java.util.Map;

public interface KafkaProducerPort {
    void publish(String bootstrapServers, KafkaSecurityConfig security,
                 String topic, byte[] key, byte[] payload, Map<String, String> headers);
}
