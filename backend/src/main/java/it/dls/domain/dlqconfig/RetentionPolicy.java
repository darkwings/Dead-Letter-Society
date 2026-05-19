package it.dls.domain.dlqconfig;

public record RetentionPolicy(RetentionType type, int value) {

    public enum RetentionType { MAX_AGE_DAYS, MAX_COUNT }

    public static RetentionPolicy maxDays(int days) {
        return new RetentionPolicy(RetentionType.MAX_AGE_DAYS, days);
    }

    public static RetentionPolicy maxCount(int count) {
        return new RetentionPolicy(RetentionType.MAX_COUNT, count);
    }
}
