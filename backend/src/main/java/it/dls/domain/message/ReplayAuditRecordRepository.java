package it.dls.domain.message;

public interface ReplayAuditRecordRepository {
    void save(ReplayAuditRecord record);
}
