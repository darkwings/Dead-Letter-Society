package it.dls.domain.message;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository {
    void save(DlqMessage message);
    Optional<DlqMessage> findById(UUID id);
    MessagePage findByConfig(UUID dlqConfigId, MessageFilter filter, Pageable pageable);
    MessagePage findAll(MessageStatus statusFilter, Pageable pageable, List<UUID> accessibleConfigIds);
    void deleteOlderThan(UUID dlqConfigId, Instant cutoff);
    void deleteExceedingCount(UUID dlqConfigId, int maxCount);
    long countByStatus(MessageStatus status);
    Map<UUID, Map<MessageStatus, Long>> countByConfigAndStatus();
    List<SparklinePoint> getSparklineData(int days);
}
