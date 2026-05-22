CREATE TABLE notes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id           UUID NOT NULL REFERENCES dlq_messages(id) ON DELETE CASCADE,
    author_id            UUID NOT NULL REFERENCES users(id),
    author_display_name  VARCHAR(255) NOT NULL,
    content              TEXT NOT NULL,
    ticket_reference     VARCHAR(100),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_message_id ON notes(message_id);
