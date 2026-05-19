package it.dls.infrastructure.persistence;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class DlqUserAssignmentId implements Serializable {
    public DlqConfigEntity dlqConfig;
    public UUID userId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DlqUserAssignmentId that)) return false;
        return Objects.equals(dlqConfig, that.dlqConfig) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dlqConfig, userId);
    }
}
