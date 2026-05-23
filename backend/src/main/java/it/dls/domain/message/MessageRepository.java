package it.dls.domain.message;

import it.dls.application.dashboard.SparklinePoint;

import java.time.Instant;
import java.util.List;
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
    List<SparklinePoint> getSparklineData(int days);
}
