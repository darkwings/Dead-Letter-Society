package it.dls.application.inspection;

import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.FailureInfo;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class FailureInfoAssembler {

    private final DlqConfigRepository configRepo;
    private final FailureInfoExtractor extractor = new FailureInfoExtractor();

    @Inject
    public FailureInfoAssembler(DlqConfigRepository configRepo) {
        this.configRepo = configRepo;
    }

    /** Message id → FailureInfo, loading each distinct DLQ config once. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Map<UUID, FailureInfo> assembleAll(Collection<DlqMessage> messages) {
        var mappings = new HashMap<UUID, HeaderMapping>();
        var result = new HashMap<UUID, FailureInfo>();
        for (var m : messages) {
            var mapping = mappings.computeIfAbsent(m.getDlqConfigId(), id ->
                configRepo.findById(id).map(c -> c.getHeaderMapping()).orElse(HeaderMapping.empty()));
            result.put(m.getId(), extractor.extract(m.getHeaders(), mapping));
        }
        return result;
    }
}
