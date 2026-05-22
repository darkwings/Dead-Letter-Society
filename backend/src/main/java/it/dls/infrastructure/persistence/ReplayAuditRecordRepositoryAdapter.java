package it.dls.infrastructure.persistence;

import it.dls.domain.message.ReplayAuditRecord;
import it.dls.domain.message.ReplayAuditRecordRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class ReplayAuditRecordRepositoryAdapter implements ReplayAuditRecordRepository {

    @Override
    @Transactional(Transactional.TxType.MANDATORY)
    public void save(ReplayAuditRecord record) {
        ReplayAuditRecordEntity.fromDomain(record).persist();
    }
}
