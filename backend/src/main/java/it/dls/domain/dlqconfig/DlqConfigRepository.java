package it.dls.domain.dlqconfig;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DlqConfigRepository {
    void save(DlqConfig config);
    Optional<DlqConfig> findById(UUID id);
    List<DlqConfig> findByClusterId(UUID clusterId);
    void delete(UUID id);
}
