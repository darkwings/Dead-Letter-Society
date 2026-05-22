package it.dls.domain.message;

import java.time.Instant;

public record MessageFilter(
    MessageStatus status,
    Instant timestampFrom,
    Instant timestampTo,
    Integer partition,
    Long offsetFrom,
    Long offsetTo
) {
    public static MessageFilter empty() {
        return new MessageFilter(null, null, null, null, null, null);
    }
}
