package it.dls.domain.message;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository {
    void save(DlqMessage message);
    Optional<DlqMessage> findById(UUID id);
    List<DlqMessage> findByDlqConfigId(UUID dlqConfigId, int page, int size);
    long countByDlqConfigId(UUID dlqConfigId);
}
