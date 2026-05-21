ALTER TABLE dlq_configs
    ADD COLUMN default_replay_topic VARCHAR(500);

CREATE TABLE replay_audit_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES dlq_messages(id) ON DELETE CASCADE,
    replayed_by     UUID NOT NULL REFERENCES users(id),
    replayed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    target_topic    VARCHAR(500),
    payload_edited  BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason  TEXT,
    attempt_count   INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_replay_audit_message ON replay_audit_records(message_id);
