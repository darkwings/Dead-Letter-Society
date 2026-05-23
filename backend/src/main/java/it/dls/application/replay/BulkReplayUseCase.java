package it.dls.application.replay;

import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.message.MessageStatus;
import it.dls.domain.message.ReplayAuditRecord;
import it.dls.domain.message.ReplayAuditRecordRepository;
import it.dls.domain.shared.EncryptionPort;
import it.dls.domain.shared.KafkaProducerPort;
import it.dls.domain.shared.NotificationPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class BulkReplayUseCase {

    @Inject KafkaProducerPort producer;
    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject NotificationPort notifier;
    @Inject ReplayAuditRecordRepository auditRepo;
    @Inject EncryptionPort encryption;

    private final ReplayTopicResolver topicResolver = new ReplayTopicResolver();

    @Transactional
    public BulkReplayResult bulkReplay(UUID dlqConfigId, List<UUID> messageIds, UUID replayedBy) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));
        var cluster = clusterRepo.findById(config.getClusterId())
            .orElseThrow(() -> new IllegalArgumentException("Cluster not found: " + config.getClusterId()));
        var security = decryptSecurity(cluster.getSecurityConfig());

        int succeeded = 0, failed = 0;
        for (UUID msgId : messageIds) {
            var msgOpt = messageRepo.findById(msgId);
            if (msgOpt.isEmpty()) continue;
            var msg = msgOpt.get();

            String targetTopic;
            try {
                targetTopic = topicResolver.resolve(msg, config, null);
            } catch (ReplayTopicNotResolvableException e) {
                failed++;
                continue;
            }

            var headers = new HashMap<>(msg.getHeaders());
            headers.put("x-dls-replayed-at", Instant.now().toString());
            headers.put("x-dls-replayed-by", replayedBy.toString());

            try {
                producer.publish(cluster.getBootstrapServers(), security,
                    targetTopic, msg.getKey(), msg.getRawPayload(), headers);
                msg.transitionTo(MessageStatus.REPLAYED);
                messageRepo.save(msg);
                auditRepo.save(ReplayAuditRecord.success(msgId, replayedBy, targetTopic, false));
                safeNotify(() -> notifier.emitMessageStatusChanged(msgId, dlqConfigId, "REPLAYED"));
                succeeded++;
            } catch (Exception e) {
                msg.transitionTo(MessageStatus.REPLAY_FAILED);
                messageRepo.save(msg);
                auditRepo.save(ReplayAuditRecord.failure(msgId, replayedBy, e.getMessage()));
                safeNotify(() -> notifier.emitMessageStatusChanged(msgId, dlqConfigId, "REPLAY_FAILED"));
                failed++;
            }
        }
        return new BulkReplayResult(succeeded, failed);
    }

    private void safeNotify(Runnable r) {
        try { r.run(); } catch (Exception ignored) {}
    }

    private KafkaSecurityConfig decryptSecurity(KafkaSecurityConfig enc) {
        return new KafkaSecurityConfig(
            enc.protocol(),
            enc.encryptedUsername() != null ? encryption.decrypt(enc.encryptedUsername()) : null,
            enc.encryptedPassword() != null ? encryption.decrypt(enc.encryptedPassword()) : null,
            enc.encryptedKeystorePem() != null ? encryption.decrypt(enc.encryptedKeystorePem()) : null
        );
    }
}
