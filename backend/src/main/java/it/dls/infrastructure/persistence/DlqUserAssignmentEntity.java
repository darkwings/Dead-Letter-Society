package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.dlqconfig.DlqRole;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "dlq_user_assignments")
@IdClass(DlqUserAssignmentId.class)
public class DlqUserAssignmentEntity extends PanacheEntityBase {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dlq_config_id")
    public DlqConfigEntity dlqConfig;

    @Id
    @Column(name = "user_id", columnDefinition = "uuid")
    public UUID userId;

    @Enumerated(EnumType.STRING)
    public DlqRole role;
}
