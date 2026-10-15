package it.dls.domain.message;

import java.time.Instant;

public record FailureInfo(
    String originalTopic,
    Integer originalPartition,
    Long originalOffset,
    Instant originalTimestamp,
    String exceptionMessage,
    String exceptionStacktrace
) {
    public static FailureInfo empty() {
        return new FailureInfo(null, null, null, null, null, null);
    }
}
