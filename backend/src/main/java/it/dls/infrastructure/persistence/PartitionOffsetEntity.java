package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.dlqconfig.PartitionOffset;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "dlq_partition_offsets")
@IdClass(PartitionOffsetId.class)
public class PartitionOffsetEntity extends PanacheEntityBase {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dlq_config_id")
    public DlqConfigEntity dlqConfig;

    @Id
    public int partition;

    @Column(name = "last_offset")
    public long lastOffset = -1L;

    @Column(name = "updated_at")
    public Instant updatedAt;

    public PartitionOffset toDomain() {
        return new PartitionOffset(partition, lastOffset);
    }
}
