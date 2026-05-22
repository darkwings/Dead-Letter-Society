package it.dls.application.fetch;

import it.dls.domain.dlqconfig.PartitionOffset;
import it.dls.domain.shared.PartitionOffsetRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class PartitionReconciliationService {

    /**
     * FETCH-003: new partitions get offset -1 (earliest).
     * FETCH-004: gap partitions restart from earliest.
     */
    public List<PartitionOffsetRequest> reconcile(
            List<PartitionOffset> stored, List<Integer> brokerPartitions,
            List<Integer> gapPartitions) {

        var storedMap = stored.stream()
            .collect(Collectors.toMap(PartitionOffset::partition, po -> po));

        var requests = new ArrayList<PartitionOffsetRequest>();
        for (int p : brokerPartitions) {
            if (!storedMap.containsKey(p)) {
                requests.add(new PartitionOffsetRequest(p, -1L)); // earliest — new partition
            } else if (gapPartitions.contains(p)) {
                requests.add(new PartitionOffsetRequest(p, -1L)); // gap: restart earliest
            } else {
                long next = storedMap.get(p).lastOffset() + 1;
                requests.add(new PartitionOffsetRequest(p, next));
            }
        }
        return requests;
    }
}
