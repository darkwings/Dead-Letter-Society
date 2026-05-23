package it.dls.application.dashboard;

import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class DashboardUseCase {

    @Inject
    MessageRepository messageRepo;

    @Transactional(Transactional.TxType.SUPPORTS)
    public DashboardSummary getSummary() {
        return new DashboardSummary(
            messageRepo.countByStatus(MessageStatus.NEW),
            messageRepo.countByStatus(MessageStatus.UNDER_REVIEW),
            messageRepo.countByStatus(MessageStatus.REPLAYED),
            messageRepo.countByStatus(MessageStatus.DISCARDED),
            messageRepo.countByStatus(MessageStatus.REPLAY_FAILED),
            Instant.now()
        );
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<SparklinePoint> getSparkline(int days) {
        return messageRepo.getSparklineData(days);
    }
}
