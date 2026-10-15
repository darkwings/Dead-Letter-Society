package it.dls.domain.dlqconfig;

import static it.dls.domain.dlqconfig.HeaderEncoding.*;

public enum HeaderPreset {
    LEGACY(new HeaderMapping(
        f("x-original-topic", STRING), null, null, null,
        f("x-exception-message", STRING), null)),
    SPRING(new HeaderMapping(
        f("kafka_dlt-original-topic", STRING),
        f("kafka_dlt-original-partition", INT32),
        f("kafka_dlt-original-offset", INT64),
        f("kafka_dlt-original-timestamp", INT64),
        f("kafka_dlt-exception-message", STRING),
        f("kafka_dlt-exception-stacktrace", STRING))),
    QUARKUS_SMALLRYE(new HeaderMapping(
        f("dead-letter-topic", STRING),
        f("dead-letter-partition", STRING),
        f("dead-letter-offset", STRING),
        null,
        f("dead-letter-reason", STRING),
        f("dead-letter-cause", STRING))),
    CUSTOM(HeaderMapping.empty());

    private final HeaderMapping mapping;

    HeaderPreset(HeaderMapping mapping) { this.mapping = mapping; }

    public HeaderMapping mapping() { return mapping; }

    private static HeaderField f(String name, HeaderEncoding enc) { return new HeaderField(name, enc); }
}
