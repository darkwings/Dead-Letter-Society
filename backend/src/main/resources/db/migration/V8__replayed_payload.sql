ALTER TABLE dlq_messages
    ADD COLUMN replayed_decoded_payload jsonb,
    ADD COLUMN replayed_raw_payload     bytea;
