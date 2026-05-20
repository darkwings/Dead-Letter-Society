package it.dls.infrastructure.persistence;

import java.io.Serializable;
import java.util.Objects;

public class PartitionOffsetId implements Serializable {
    public DlqConfigEntity dlqConfig;
    public int partition;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PartitionOffsetId that)) return false;
        return partition == that.partition && Objects.equals(dlqConfig, that.dlqConfig);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dlqConfig, partition);
    }
}
