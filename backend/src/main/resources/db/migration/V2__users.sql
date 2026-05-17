CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255) NOT NULL,
    auth_provider VARCHAR(10)  NOT NULL CHECK (auth_provider IN ('LOCAL','OIDC')),
    global_role   VARCHAR(10)  NOT NULL DEFAULT 'USER' CHECK (global_role IN ('ADMIN','USER')),
    password_hash VARCHAR(255),
    oidc_subject  VARCHAR(255),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oidc_subject ON users(oidc_subject) WHERE oidc_subject IS NOT NULL;
