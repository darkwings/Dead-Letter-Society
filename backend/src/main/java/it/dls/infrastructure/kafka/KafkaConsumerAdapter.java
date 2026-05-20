package it.dls.infrastructure.kafka;

import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.KafkaSecurityProtocol;
import it.dls.domain.shared.KafkaConsumerPort;
import it.dls.domain.shared.PartitionOffsetRequest;
import it.dls.domain.shared.RawKafkaMessage;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.config.SaslConfigs;
import org.apache.kafka.common.config.SslConfigs;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@ApplicationScoped
public class KafkaConsumerAdapter implements KafkaConsumerPort {

    private static final Logger log = Logger.getLogger(KafkaConsumerAdapter.class);
    private static final Duration POLL_TIMEOUT = Duration.ofMillis(500);
    private static final int ADMIN_TIMEOUT_MS = 10_000;

    @Override
    public List<Integer> getPartitions(String bootstrapServers, KafkaSecurityConfig security,
                                       String topicName) {
        var props = buildAdminProps(bootstrapServers, security);
        try (var admin = AdminClient.create(props)) {
            var result = admin.describeTopics(List.of(topicName));
            var description = result.topicNameValues().get(topicName).get(ADMIN_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            return description.partitions().stream()
                .map(p -> p.partition())
                .sorted()
                .toList();
        } catch (Exception e) {
            throw new RuntimeException("Failed to get partitions for topic " + topicName, e);
        }
    }

    @Override
    public Map<Integer, Long> getEarliestOffsets(String bootstrapServers, KafkaSecurityConfig security,
                                                  String topicName, List<Integer> partitions) {
        var props = buildConsumerProps(bootstrapServers, security);
        try (var consumer = new KafkaConsumer<byte[], byte[]>(props)) {
            var topicPartitions = partitions.stream()
                .map(p -> new TopicPartition(topicName, p))
                .toList();
            consumer.assign(topicPartitions);
            var beginningOffsets = consumer.beginningOffsets(topicPartitions);
            return beginningOffsets.entrySet().stream()
                .collect(Collectors.toMap(e -> e.getKey().partition(), Map.Entry::getValue));
        } catch (Exception e) {
            throw new RuntimeException("Failed to get earliest offsets for topic " + topicName, e);
        }
    }

    @Override
    public List<RawKafkaMessage> fetch(String bootstrapServers, KafkaSecurityConfig security,
                                       String topicName, List<PartitionOffsetRequest> offsetRequests,
                                       int maxMessages) {
        if (offsetRequests.isEmpty()) return List.of();

        var props = buildConsumerProps(bootstrapServers, security);
        var messages = new ArrayList<RawKafkaMessage>();

        try (var consumer = new KafkaConsumer<byte[], byte[]>(props)) {
            var topicPartitions = offsetRequests.stream()
                .map(r -> new TopicPartition(topicName, r.partition()))
                .toList();
            consumer.assign(topicPartitions);

            // Seek each partition to the requested offset
            var beginningOffsets = consumer.beginningOffsets(topicPartitions);
            for (var request : offsetRequests) {
                var tp = new TopicPartition(topicName, request.partition());
                if (request.fromOffset() < 0) {
                    consumer.seekToBeginning(List.of(tp));
                } else {
                    consumer.seek(tp, request.fromOffset());
                }
            }

            // Track per-partition count to enforce batchSize limit
            var countPerPartition = new HashMap<Integer, Integer>();
            offsetRequests.forEach(r -> countPerPartition.put(r.partition(), 0));

            // Poll until all partitions have reached their limit or no more records
            int emptyPolls = 0;
            while (emptyPolls < 3 && !allFull(countPerPartition, maxMessages)) {
                var records = consumer.poll(POLL_TIMEOUT);
                if (records.isEmpty()) {
                    emptyPolls++;
                    continue;
                }
                emptyPolls = 0;

                for (var record : records) {
                    int partition = record.partition();
                    int count = countPerPartition.getOrDefault(partition, 0);
                    if (count >= maxMessages) continue;

                    var headers = new HashMap<String, String>();
                    for (var h : record.headers()) {
                        if (h.value() != null) {
                            headers.put(h.key(), new String(h.value()));
                        }
                    }

                    messages.add(new RawKafkaMessage(
                        partition, record.offset(),
                        Instant.ofEpochMilli(record.timestamp()),
                        record.key(), record.value(),
                        Collections.unmodifiableMap(headers)
                    ));
                    countPerPartition.put(partition, count + 1);
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Fetch failed for topic " + topicName, e);
        }
        return messages;
    }

    private boolean allFull(Map<Integer, Integer> counts, int maxMessages) {
        return counts.values().stream().allMatch(c -> c >= maxMessages);
    }

    private Properties buildAdminProps(String bootstrapServers, KafkaSecurityConfig security) {
        var props = buildBaseProps(bootstrapServers, security);
        props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, String.valueOf(ADMIN_TIMEOUT_MS));
        props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, String.valueOf(ADMIN_TIMEOUT_MS));
        return props;
    }

    private Properties buildConsumerProps(String bootstrapServers, KafkaSecurityConfig security) {
        var props = buildBaseProps(bootstrapServers, security);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "dls-consumer-" + UUID.randomUUID());
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "500");
        return props;
    }

    private Properties buildBaseProps(String bootstrapServers, KafkaSecurityConfig security) {
        var props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        switch (security.protocol()) {
            case PLAINTEXT -> props.put("security.protocol", "PLAINTEXT");
            case SSL -> {
                props.put("security.protocol", "SSL");
                props.put(SslConfigs.SSL_KEYSTORE_TYPE_CONFIG, "PEM");
                props.put(SslConfigs.SSL_KEYSTORE_CERTIFICATE_CHAIN_CONFIG,
                    security.encryptedKeystorePem());
            }
            case SASL_PLAIN -> {
                props.put("security.protocol", "SASL_SSL");
                props.put(SaslConfigs.SASL_MECHANISM, "PLAIN");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.plain.PlainLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_256 -> {
                props.put("security.protocol", "SASL_SSL");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-256");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_512 -> {
                props.put("security.protocol", "SASL_SSL");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-512");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
        }
        return props;
    }

    private String buildJaas(String loginModule, String username, String password) {
        return loginModule + " required username=\"" + username + "\" password=\"" + password + "\";";
    }
}
