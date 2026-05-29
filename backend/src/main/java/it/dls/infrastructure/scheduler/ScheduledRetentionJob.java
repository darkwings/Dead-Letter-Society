package it.dls.infrastructure.scheduler;

import io.quarkus.scheduler.Scheduled;
import it.dls.application.retention.RetentionJob;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class ScheduledRetentionJob {

    private static final Logger log = Logger.getLogger(ScheduledRetentionJob.class);

    @Inject
    RetentionJob retentionJob;

    @Scheduled(cron = "0 0 2 * * ?", identity = "scheduled-retention")
    void run() {
        log.debug("Scheduled retention tick");
        retentionJob.applyRetention();
    }
}
