ALTER TABLE dlq_configs
    ADD COLUMN IF NOT EXISTS header_preset VARCHAR(30) NOT NULL DEFAULT 'LEGACY';

ALTER TABLE dlq_configs
    ADD COLUMN IF NOT EXISTS header_mapping JSONB NOT NULL DEFAULT
    '{"originalTopic":{"name":"x-original-topic","encoding":"STRING"},"originalPartition":null,"originalOffset":null,"originalTimestamp":null,"exceptionMessage":{"name":"x-exception-message","encoding":"STRING"},"exceptionStacktrace":null}'::jsonb;
