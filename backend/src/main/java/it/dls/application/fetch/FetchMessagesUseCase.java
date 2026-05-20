package it.dls.application.fetch;

import com.fasterxml.jackson.databind.JsonNode;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.PartitionOffset;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.shared.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class FetchMessagesUseCase {

    private static final Logger log = Logger.getLogger(FetchMessagesUseCase.class);

    private final KafkaConsumerPort kafkaConsumer;
    private final SchemaRegistryPort schemaRegistry;
    private final DlqConfigRepository configRepo;
    private final KafkaClusterRepository clusterRepo;
    private final MessageRepository messageRepo;
    private final NotificationPort notifier;
    private final FetchLockService fetchLockService;
    private final EncryptionPort encryption;
    private final PartitionReconciliationService reconciliationService;

    @Inject
    public FetchMessagesUseCase(
            KafkaConsumerPort kafkaConsumer,
            SchemaRegistryPort schemaRegistry,
            DlqConfigRepository configRepo,
            KafkaClusterRepository clusterRepo,
            MessageRepository messageRepo,
            NotificationPort notifier,
            FetchLockService fetchLockService,
            EncryptionPort encryption) {
        this.kafkaConsumer = kafkaConsumer;
        this.schemaRegistry = schemaRegistry;
        this.configRepo = configRepo;
        this.clusterRepo = clusterRepo;
        this.messageRepo = messageRepo;
        this.notifier = notifier;
        this.fetchLockService = fetchLockService;
        this.encryption = encryption;
        this.reconciliationService = new PartitionReconciliationService();
    }

    /** FETCH-009: on-demand fetch blocked if another fetch running — FETCH-010. */
    @Transactional
    public FetchResult fetchOnDemand(UUID dlqConfigId, UUID requestedBy) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));

        if (!fetchLockService.tryLock(dlqConfigId)) {
            throw new FetchAlreadyInProgressException(dlqConfigId);
        }
        try {
            return doFetch(config);
        } finally {
            fetchLockService.unlock(dlqConfigId);
        }
    }

    /** Called by ScheduledFetchJob — no lock check (scheduler ensures no overlap). */
    @Transactional
    public FetchResult fetchScheduled(UUID dlqConfigId) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new IllegalArgumentException("DlqConfig not found: " + dlqConfigId));

        if (!fetchLockService.tryLock(dlqConfigId)) {
            log.infof("Skipping scheduled fetch for %s — already in progress", dlqConfigId);
            return FetchResult.of(0);
        }
        try {
            return doFetch(config);
        } finally {
            fetchLockService.unlock(dlqConfigId);
        }
    }

    private FetchResult doFetch(DlqConfig config) {
        try {
            var cluster = clusterRepo.findById(config.getClusterId())
                .orElseThrow(() -> new IllegalArgumentException("Cluster not found: " + config.getClusterId()));

            var security = decryptSecurity(cluster);
            var srAuth = decryptSchemaRegistryAuth(cluster);

            // FETCH-003: partition reconciliation
            var brokerPartitions = kafkaConsumer.getPartitions(
                cluster.getBootstrapServers(), security, config.getTopicName());
            // Snapshot before mutation — unmodifiableList is a view, not a copy
            var storedSnapshot = List.copyOf(config.getPartitionOffsets());
            var earliest = kafkaConsumer.getEarliestOffsets(
                cluster.getBootstrapServers(), security, config.getTopicName(), brokerPartitions);

            // FETCH-004: gap detection — log and restart from earliest
            var gapPartitions = detectGaps(storedSnapshot, earliest);
            for (int p : gapPartitions) {
                long expected = storedSnapshot.stream()
                    .filter(po -> po.partition() == p).findFirst()
                    .map(po -> po.lastOffset() + 1).orElse(0L);
                log.warnf("Gap detected on %s partition %d — expected %d, earliest available %d — restarting from earliest",
                    config.getTopicName(), p, expected, earliest.getOrDefault(p, -1L));
            }

            // Ensure new partitions have tracked entry with -1
            updateStoredPartitions(config, brokerPartitions);

            var requests = reconciliationService.reconcile(storedSnapshot, brokerPartitions, gapPartitions);

            // FETCH-005: consume at most batchSize messages per partition
            var raw = kafkaConsumer.fetch(cluster.getBootstrapServers(), security,
                config.getTopicName(), requests, config.getFetchConfig().batchSize());

            // FETCH-011, FETCH-012: ingest with schema decode attempt
            var messages = raw.stream()
                .map(r -> ingest(r, config, cluster, srAuth))
                .toList();
            messages.forEach(messageRepo::save);

            // FETCH-001: update committed offsets in our DB, not broker
            updateCommittedOffsets(config, raw);
            configRepo.save(config);

            // FETCH-006: emit SSE on success
            notifier.emitFetchCompleted(config.getId(), messages.size());

            return FetchResult.of(messages.size());
        } catch (Exception e) {
            // FETCH-008: emit SSE on failure
            notifier.emitFetchFailed(config.getId(), e.getMessage());
            throw e;
        }
    }

    /** FETCH-004: a gap = broker's earliest offset surpassed our next expected offset. */
    private List<Integer> detectGaps(List<PartitionOffset> stored, Map<Integer, Long> earliest) {
        return stored.stream()
            .filter(po -> {
                Long brokerEarliest = earliest.get(po.partition());
                return brokerEarliest != null
                    && po.lastOffset() >= 0
                    && po.lastOffset() + 1 < brokerEarliest;
            })
            .map(PartitionOffset::partition)
            .toList();
    }

    /** FETCH-002, FETCH-003: register new partitions with -1 so they start at earliest. */
    private void updateStoredPartitions(DlqConfig config, List<Integer> brokerPartitions) {
        var knownPartitions = config.getPartitionOffsets().stream()
            .map(PartitionOffset::partition)
            .collect(Collectors.toSet());
        for (int p : brokerPartitions) {
            if (!knownPartitions.contains(p)) {
                config.updatePartitionOffset(p, -1L);
            }
        }
    }

    /** FETCH-001: advance committed offsets in DB using max offset seen per partition. */
    private void updateCommittedOffsets(DlqConfig config, List<RawKafkaMessage> raw) {
        raw.stream()
            .collect(Collectors.groupingBy(
                RawKafkaMessage::partition,
                Collectors.maxBy(Comparator.comparingLong(RawKafkaMessage::offset))))
            .forEach((partition, maxMsg) ->
                maxMsg.ifPresent(m -> config.updatePartitionOffset(partition, m.offset())));
    }

    /** FETCH-011, FETCH-012: decode payload; on failure mark schemaDecodeFailed=true. */
    private DlqMessage ingest(RawKafkaMessage raw, DlqConfig config,
                               KafkaCluster cluster, SchemaRegistryAuthConfig srAuth) {
        JsonNode decoded = null;
        Integer schemaId = null;
        boolean decodeFailed = false;

        String srUrl = cluster.getSchemaRegistry() != null
            ? cluster.getSchemaRegistry().url() : null;

        if (srUrl != null && raw.value() != null && raw.value().length > 0) {
            try {
                var result = schemaRegistry.decode(raw.value(), srUrl, srAuth);
                decoded = result.payload();
                schemaId = result.schemaId();
            } catch (Exception e) {
                decodeFailed = true;
                log.debugf("Schema decode failed for %s partition %d offset %d: %s",
                    config.getTopicName(), raw.partition(), raw.offset(), e.getMessage());
            }
        }

        return DlqMessage.ingest(
            config.getId(), raw.partition(), raw.offset(), raw.timestamp(),
            raw.key(), raw.value(), decoded, schemaId, raw.headers(), decodeFailed);
    }

    private KafkaSecurityConfig decryptSecurity(KafkaCluster cluster) {
        var enc = cluster.getSecurityConfig();
        return new KafkaSecurityConfig(
            enc.protocol(),
            enc.encryptedUsername() != null ? encryption.decrypt(enc.encryptedUsername()) : null,
            enc.encryptedPassword() != null ? encryption.decrypt(enc.encryptedPassword()) : null,
            enc.encryptedKeystorePem() != null ? encryption.decrypt(enc.encryptedKeystorePem()) : null
        );
    }

    private SchemaRegistryAuthConfig decryptSchemaRegistryAuth(KafkaCluster cluster) {
        if (cluster.getSchemaRegistry() == null) return SchemaRegistryAuthConfig.none();
        var enc = cluster.getSchemaRegistry().authConfig();
        if (!enc.hasCredentials()) return SchemaRegistryAuthConfig.none();
        return new SchemaRegistryAuthConfig(
            encryption.decrypt(enc.encryptedUsername()),
            encryption.decrypt(enc.encryptedPassword())
        );
    }
}
