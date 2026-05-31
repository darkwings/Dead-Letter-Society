package it.dls.application.replay;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.DlqMessage;
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

    private static final String VALUE_SUBJECT_SUFFIX = "-value";

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

        var sr = (msg.getSchemaId() != null) ? cluster.getSchemaRegistry() : null;
        var srUrl = sr != null ? sr.url() : null;
        var srAuth = sr != null ? sr.authConfig().decrypted(encryption) : null;

        var targetTopic = topicResolver.resolve(msg, config, wizardTopicOverride);

        var targetSchemaId = resolveAndValidateTargetSchema(editedPayload, targetTopic, srUrl, srAuth);

        var headers = new HashMap<>(msg.getHeaders());
        headers.put("x-dls-replayed-at", Instant.now().toString());
        headers.put("x-dls-replayed-by", replayedBy.toString());

        try {
            var payload = resolvePayload(msg, editedPayload, targetSchemaId, srUrl, srAuth);

            producer.publish(cluster.getBootstrapServers(),
                cluster.getSecurityConfig().decrypted(encryption),
                targetTopic, msg.getKey(), payload, headers);

            if (editedPayload != null) msg.setReplayedPayload(editedPayload, payload);
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

    private Integer resolveAndValidateTargetSchema(JsonNode editedPayload, String targetTopic,
                                                    String srUrl, SchemaRegistryAuthConfig srAuth) {
        if (editedPayload == null || srUrl == null) return null;
        int schemaId = schemaRegistry.resolveLatestSchemaId(targetTopic + VALUE_SUBJECT_SUFFIX, srUrl, srAuth);
        var validation = schemaRegistry.validate(editedPayload, schemaId, srUrl, srAuth);
        if (!validation.valid()) throw new SchemaValidationException(validation.error());
        return schemaId;
    }

    private byte[] resolvePayload(DlqMessage msg, JsonNode editedPayload,
                                   Integer targetSchemaId, String srUrl, SchemaRegistryAuthConfig srAuth) {
        if (editedPayload == null) return msg.getRawPayload();
        if (srUrl == null || targetSchemaId == null) return editedPayload.toString().getBytes(StandardCharsets.UTF_8);
        return schemaRegistry.encode(editedPayload, targetSchemaId, srUrl, srAuth);
    }

    private void safeNotify(Runnable r) {
        try { r.run(); } catch (Exception ignored) {}
    }
}
