package it.dls.domain.shared;

import java.time.Instant;
import java.util.Map;

public record RawKafkaMessage(
    int partition,
    long offset,
    Instant timestamp,
    byte[] key,
    byte[] value,
    Map<String, String> headers
) {}
