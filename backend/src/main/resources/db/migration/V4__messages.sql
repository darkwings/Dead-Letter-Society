CREATE TABLE dlq_messages (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dlq_config_id        UUID NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    partition            INT NOT NULL,
    kafka_offset         BIGINT NOT NULL,
    kafka_timestamp      TIMESTAMPTZ NOT NULL,
    message_key          BYTEA,
    raw_payload          BYTEA NOT NULL,
    decoded_payload      JSONB,
    schema_id            INT,
    headers              JSONB NOT NULL DEFAULT '{}',
    status               VARCHAR(20) NOT NULL DEFAULT 'NEW'
                             CHECK (status IN ('NEW','UNDER_REVIEW','REPLAYED','DISCARDED','REPLAY_FAILED')),
    schema_decode_failed BOOLEAN NOT NULL DEFAULT FALSE,
    ingested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dlq_config_id, partition, kafka_offset)
);

CREATE INDEX idx_dlq_messages_config_status ON dlq_messages(dlq_config_id, status);
CREATE INDEX idx_dlq_messages_timestamp     ON dlq_messages(kafka_timestamp);
CREATE INDEX idx_dlq_messages_partition     ON dlq_messages(dlq_config_id, partition);
