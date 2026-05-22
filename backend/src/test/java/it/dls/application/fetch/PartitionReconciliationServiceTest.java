package it.dls.application.fetch;

import it.dls.domain.dlqconfig.PartitionOffset;
import it.dls.domain.shared.PartitionOffsetRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FETCH-002: new partition starts from earliest (-1).
 * FETCH-003: partition reconciliation queries broker partitions and adds new ones.
 * FETCH-004: gap partition restarts from earliest (-1).
 */
class PartitionReconciliationServiceTest {

    private final PartitionReconciliationService service = new PartitionReconciliationService();

    @Test
    void newPartition_noStoredOffset_setsFromOffsetMinusOne() {
        // FETCH-002, FETCH-003
        var stored = List.<PartitionOffset>of();
        var brokerPartitions = List.of(0);
        var gapPartitions = List.<Integer>of();

        var requests = service.reconcile(stored, brokerPartitions, gapPartitions);

        assertThat(requests).hasSize(1);
        assertThat(requests.get(0).partition()).isEqualTo(0);
        assertThat(requests.get(0).fromOffset()).isEqualTo(-1L);
    }

    @Test
    void knownPartition_noGap_continuesFromNextOffset() {
        var stored = List.of(new PartitionOffset(0, 99L));
        var brokerPartitions = List.of(0);
        var gapPartitions = List.<Integer>of();

        var requests = service.reconcile(stored, brokerPartitions, gapPartitions);

        assertThat(requests.get(0).fromOffset()).isEqualTo(100L);
    }

    @Test
    void gapPartition_restartsFromEarliest() {
        // FETCH-004
        var stored = List.of(new PartitionOffset(0, 50L));
        var brokerPartitions = List.of(0);
        var gapPartitions = List.of(0); // broker earliest is now 100 — gap detected

        var requests = service.reconcile(stored, brokerPartitions, gapPartitions);

        assertThat(requests.get(0).fromOffset()).isEqualTo(-1L);
    }

    @Test
    void mixedPartitions_newAndKnownAndGap_correctRequests() {
        // FETCH-002, FETCH-003, FETCH-004
        var stored = List.of(
            new PartitionOffset(0, 200L),  // known, no gap
            new PartitionOffset(1, 50L)    // gap
        );
        var brokerPartitions = List.of(0, 1, 2); // 2 is new
        var gapPartitions = List.of(1);

        var requests = service.reconcile(stored, brokerPartitions, gapPartitions);

        assertThat(requests).hasSize(3);
        var byPartition = requests.stream()
            .collect(java.util.stream.Collectors.toMap(PartitionOffsetRequest::partition, r -> r));

        assertThat(byPartition.get(0).fromOffset()).isEqualTo(201L); // continue
        assertThat(byPartition.get(1).fromOffset()).isEqualTo(-1L);  // gap restart
        assertThat(byPartition.get(2).fromOffset()).isEqualTo(-1L);  // new partition
    }

    @Test
    void emptyBrokerPartitions_returnsEmptyRequests() {
        var stored = List.of(new PartitionOffset(0, 10L));
        var requests = service.reconcile(stored, List.of(), List.of());
        assertThat(requests).isEmpty();
    }

    @Test
    void partitionWithLastOffsetMinusOne_continuesFromOffset0() {
        // Partition tracked at -1 means it hasn't been read yet — next is 0
        var stored = List.of(new PartitionOffset(0, -1L));
        var brokerPartitions = List.of(0);
        var gapPartitions = List.<Integer>of();

        var requests = service.reconcile(stored, brokerPartitions, gapPartitions);

        assertThat(requests.get(0).fromOffset()).isEqualTo(0L);
    }
}
