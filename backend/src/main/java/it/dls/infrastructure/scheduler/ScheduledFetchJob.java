package it.dls.infrastructure.scheduler;

import io.quarkus.scheduler.Scheduled;
import it.dls.application.fetch.FetchMessagesUseCase;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.DownloadMode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@ApplicationScoped
public class ScheduledFetchJob {

    private static final Logger log = Logger.getLogger(ScheduledFetchJob.class);

    private final DlqConfigRepository configRepo;
    private final FetchMessagesUseCase fetchUseCase;
    private final Executor executor = Executors.newVirtualThreadPerTaskExecutor();

    @Inject
    public ScheduledFetchJob(DlqConfigRepository configRepo, FetchMessagesUseCase fetchUseCase) {
        this.configRepo = configRepo;
        this.fetchUseCase = fetchUseCase;
    }

    @Scheduled(every = "1m", identity = "scheduled-fetch")
    void runScheduledFetches() {
        var configs = configRepo.findAllWithScheduledFetch();
        log.debugf("Scheduled fetch tick: %d configs eligible", configs.size());

        configs.stream()
            .filter(c -> c.getFetchConfig().mode() != DownloadMode.ON_DEMAND)
            .forEach(c -> executor.execute(() -> {
                try {
                    var result = fetchUseCase.fetchScheduled(c.getId());
                    log.infof("Scheduled fetch completed for %s: %d new messages",
                        c.getTopicName(), result.count());
                } catch (Exception e) {
                    log.errorf("Scheduled fetch failed for %s: %s", c.getTopicName(), e.getMessage());
                }
            }));
    }
}
