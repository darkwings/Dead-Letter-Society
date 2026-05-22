package it.dls.infrastructure.kafka;

import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.shared.KafkaProducerPort;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.apache.kafka.common.serialization.ByteArraySerializer;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class KafkaProducerAdapter implements KafkaProducerPort {

    private static final int SEND_TIMEOUT_SECONDS = 30;

    @Override
    public void publish(String bootstrapServers, KafkaSecurityConfig security,
                        String topic, byte[] key, byte[] payload, Map<String, String> headers) {
        var props = buildProducerProps(bootstrapServers, security);
        try (var producer = new KafkaProducer<byte[], byte[]>(props)) {
            var record = new ProducerRecord<>(topic, null, key, payload);
            if (headers != null) {
                headers.forEach((k, v) ->
                    record.headers().add(new RecordHeader(k, v.getBytes(StandardCharsets.UTF_8))));
            }
            producer.send(record).get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException("Failed to publish to topic " + topic + ": " + e.getMessage(), e);
        }
    }

    private Properties buildProducerProps(String bootstrapServers, KafkaSecurityConfig security) {
        var props = KafkaSecurityPropsBuilder.base(bootstrapServers, security);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, "0");
        return props;
    }
}
