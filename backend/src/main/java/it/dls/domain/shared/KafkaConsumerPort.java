package it.dls.domain.shared;

import it.dls.domain.cluster.KafkaSecurityConfig;

import java.util.List;
import java.util.Map;

public interface KafkaConsumerPort {

    List<RawKafkaMessage> fetch(String bootstrapServers, KafkaSecurityConfig security,
                                String topicName, List<PartitionOffsetRequest> offsets,
                                int maxMessages);

    List<Integer> getPartitions(String bootstrapServers, KafkaSecurityConfig security,
                                String topicName);

    Map<Integer, Long> getEarliestOffsets(String bootstrapServers, KafkaSecurityConfig security,
                                          String topicName, List<Integer> partitions);
}
