package it.dls.domain.dlqconfig;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DlqConfigRepository {
    void save(DlqConfig config);
    Optional<DlqConfig> findById(UUID id);
    List<DlqConfig> findAll();
    List<DlqConfig> findByClusterId(UUID clusterId);
    List<DlqConfig> findAllWithScheduledFetch();
    void delete(UUID id);
}
