package it.dls.domain.dlqconfig;

public record FetchConfig(DownloadMode mode, String cronExpression, int batchSize) {

    public static FetchConfig scheduled(String cron, int batchSize) {
        if (cron == null || cron.isBlank())
            throw new IllegalArgumentException("cronExpression required for SCHEDULED mode");
        return new FetchConfig(DownloadMode.SCHEDULED, cron, batchSize);
    }

    public static FetchConfig onDemand(int batchSize) {
        return new FetchConfig(DownloadMode.ON_DEMAND, null, batchSize);
    }

    public static FetchConfig both(String cron, int batchSize) {
        if (cron == null || cron.isBlank())
            throw new IllegalArgumentException("cronExpression required for BOTH mode");
        return new FetchConfig(DownloadMode.BOTH, cron, batchSize);
    }
}
