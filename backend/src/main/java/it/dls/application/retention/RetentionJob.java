package it.dls.application.retention;

import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.MessageRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;
import io.quarkus.scheduler.Scheduled;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@ApplicationScoped
public class RetentionJob {

    private static final Logger log = Logger.getLogger(RetentionJob.class);

    @Inject DlqConfigRepository configRepo;
    @Inject MessageRepository messageRepo;

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void applyRetention() {
        var configs = configRepo.findAll();
        for (var config : configs) {
            var policy = config.getRetentionPolicy();
            try {
                switch (policy.type()) {
                    case MAX_AGE_DAYS -> messageRepo.deleteOlderThan(
                        config.getId(),
                        Instant.now().minus(policy.value(), ChronoUnit.DAYS));
                    case MAX_COUNT -> messageRepo.deleteExceedingCount(
                        config.getId(), policy.value());
                }
            } catch (Exception e) {
                log.errorf(e, "Retention failed for dlqConfig %s", config.getId());
            }
        }
    }
}
