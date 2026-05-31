package it.dls.application.replay;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.ReplayAuditRecord;
import it.dls.domain.message.ReplayAuditRecordRepository;
import it.dls.domain.shared.EncryptionPort;
import it.dls.domain.shared.KafkaProducerPort;
import it.dls.domain.shared.NotificationPort;
import it.dls.domain.shared.SchemaRegistryPort;
import it.dls.domain.shared.ValidationResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

@ApplicationScoped
public class ReplayMessageUseCase {

    @Inject KafkaProducerPort producer;
    @Inject SchemaRegistryPort schemaRegistry;
    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject NotificationPort notifier;
    @Inject ReplayAuditRecordRepository auditRepo;
    @Inject EncryptionPort encryption;

    private final ReplayTopicResolver topicResolver = new ReplayTopicResolver();

    @Transactional
    public ReplayResult replay(UUID messageId, String wizardTopicOverride,
                               JsonNode editedPayload, UUID replayedBy) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        var config = configRepo.findById(msg.getDlqConfigId())
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + msg.getDlqConfigId()));
        var cluster = clusterRepo.findById(config.getClusterId())
            .orElseThrow(() -> new IllegalArgumentException("Cluster not found: " + config.getClusterId()));

        if (editedPayload != null && msg.getSchemaId() != null && cluster.getSchemaRegistry() != null) {
            var srAuth = cluster.getSchemaRegistry().authConfig().decrypted(encryption);
            var validation = schemaRegistry.validate(editedPayload, msg.getSchemaId(),
                cluster.getSchemaRegistry().url(), srAuth);
            if (!validation.valid())
                throw new SchemaValidationException(validation.error());
        }

        var targetTopic = topicResolver.resolve(msg, config, wizardTopicOverride);

        var headers = new HashMap<>(msg.getHeaders());
        headers.put("x-dls-replayed-at", Instant.now().toString());
        headers.put("x-dls-replayed-by", replayedBy.toString());

        try {
            byte[] payload;
            if (editedPayload != null) {
                if (msg.getSchemaId() != null && cluster.getSchemaRegistry() != null) {
                    var srAuth = cluster.getSchemaRegistry().authConfig().decrypted(encryption);
                    payload = schemaRegistry.encode(editedPayload, msg.getSchemaId(),
                        cluster.getSchemaRegistry().url(), srAuth);
                } else {
                    payload = editedPayload.toString().getBytes(StandardCharsets.UTF_8);
                }
            } else {
                payload = msg.getRawPayload();
            }

            producer.publish(cluster.getBootstrapServers(),
                cluster.getSecurityConfig().decrypted(encryption),
                targetTopic, msg.getKey(), payload, headers);

            msg.transitionTo(MessageStatus.REPLAYED);
            messageRepo.save(msg);
            auditRepo.save(ReplayAuditRecord.success(messageId, replayedBy,
                targetTopic, editedPayload != null));
            safeNotify(() -> notifier.emitMessageStatusChanged(
                messageId, msg.getDlqConfigId(), "REPLAYED"));
            return ReplayResult.success(targetTopic);
        } catch (Exception e) {
            msg.transitionTo(MessageStatus.REPLAY_FAILED);
            messageRepo.save(msg);
            auditRepo.save(ReplayAuditRecord.failure(messageId, replayedBy, e.getMessage()));
            safeNotify(() -> notifier.emitMessageStatusChanged(
                messageId, msg.getDlqConfigId(), "REPLAY_FAILED"));
            return ReplayResult.failure(e.getMessage());
        }
    }

    public ValidationResult validatePayload(UUID messageId, JsonNode payload) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        if (msg.getSchemaId() == null) return ValidationResult.ok();
        var config = configRepo.findById(msg.getDlqConfigId()).orElse(null);
        var cluster = config != null ? clusterRepo.findById(config.getClusterId()).orElse(null) : null;
        if (cluster == null || cluster.getSchemaRegistry() == null)
            return ValidationResult.ok();
        var srAuth = cluster.getSchemaRegistry().authConfig().decrypted(encryption);
        return schemaRegistry.validate(payload, msg.getSchemaId(),
            cluster.getSchemaRegistry().url(), srAuth);
    }

    private void safeNotify(Runnable r) {
        try { r.run(); } catch (Exception ignored) {}
    }
}
