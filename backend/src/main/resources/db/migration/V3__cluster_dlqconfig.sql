CREATE TABLE kafka_clusters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    bootstrap_servers   TEXT NOT NULL,
    security_protocol   VARCHAR(30) NOT NULL,
    encrypted_username  TEXT,
    encrypted_password  TEXT,
    encrypted_keystore  TEXT,
    sr_url              TEXT,
    sr_encrypted_user   TEXT,
    sr_encrypted_pass   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dlq_configs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id           UUID NOT NULL REFERENCES kafka_clusters(id) ON DELETE CASCADE,
    topic_name           VARCHAR(500) NOT NULL,
    display_name         VARCHAR(255) NOT NULL,
    download_mode        VARCHAR(20) NOT NULL CHECK (download_mode IN ('SCHEDULED','ON_DEMAND','BOTH')),
    cron_expression      VARCHAR(100),
    batch_size           INT NOT NULL DEFAULT 500,
    retention_type       VARCHAR(20) NOT NULL CHECK (retention_type IN ('MAX_AGE_DAYS','MAX_COUNT')),
    retention_value      INT NOT NULL,
    schema_registry_id   UUID,
    default_replay_topic VARCHAR(500),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cluster_id, topic_name)
);

CREATE TABLE dlq_user_assignments (
    dlq_config_id UUID NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('VIEWER','OPERATOR')),
    PRIMARY KEY (dlq_config_id, user_id)
);

CREATE TABLE dlq_partition_offsets (
    dlq_config_id UUID    NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    partition     INT     NOT NULL,
    last_offset   BIGINT  NOT NULL DEFAULT -1,
    status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (dlq_config_id, partition)
);
