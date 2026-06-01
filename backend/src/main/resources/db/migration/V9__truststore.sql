ALTER TABLE kafka_clusters
    ADD COLUMN encrypted_truststore    TEXT,
    ADD COLUMN sr_encrypted_truststore TEXT;
