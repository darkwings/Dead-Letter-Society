package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.dlqconfig.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ManageDlqConfigUseCaseTest {

    DlqConfigRepository dlqConfigRepo;
    KafkaClusterRepository clusterRepo;
    ManageDlqConfigUseCase useCase;

    UUID clusterId = UUID.randomUUID();
    UUID configId  = UUID.randomUUID();
    UUID userId    = UUID.randomUUID();

    DlqConfig sampleConfig() {
        return DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
            FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
    }

    @BeforeEach
    void setUp() {
        dlqConfigRepo = mock(DlqConfigRepository.class);
        clusterRepo   = mock(KafkaClusterRepository.class);
        useCase       = new ManageDlqConfigUseCase(dlqConfigRepo, clusterRepo);
    }

    // ── assignUser ────────────────────────────────────────────────────────────

    @Test
    void assignUserDelegatesToDomainAndSaves() {
        var config = sampleConfig();
        when(dlqConfigRepo.findById(config.getId())).thenReturn(Optional.of(config));

        useCase.assignUser(config.getId(), userId, DlqRole.OPERATOR);

        assertThat(config.getUserAssignments()).hasSize(1);
        assertThat(config.getUserAssignments().get(0).userId()).isEqualTo(userId);
        assertThat(config.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
        verify(dlqConfigRepo).save(config);
    }

    @Test
    void assignUserThrowsWhenConfigNotFound() {
        when(dlqConfigRepo.findById(configId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.assignUser(configId, userId, DlqRole.VIEWER))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining(configId.toString());
    }

    @Test
    void assignUserOverwritesExistingRole() {
        var config = sampleConfig();
        config.assignUser(userId, DlqRole.VIEWER);
        when(dlqConfigRepo.findById(config.getId())).thenReturn(Optional.of(config));

        useCase.assignUser(config.getId(), userId, DlqRole.OPERATOR);

        assertThat(config.getUserAssignments()).hasSize(1);
        assertThat(config.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
    }

    // ── revokeUser ────────────────────────────────────────────────────────────

    @Test
    void revokeUserRemovesAssignmentAndSaves() {
        var config = sampleConfig();
        config.assignUser(userId, DlqRole.OPERATOR);
        when(dlqConfigRepo.findById(config.getId())).thenReturn(Optional.of(config));

        useCase.revokeUser(config.getId(), userId);

        assertThat(config.getUserAssignments()).isEmpty();
        verify(dlqConfigRepo).save(config);
    }

    @Test
    void revokeUserThrowsWhenConfigNotFound() {
        when(dlqConfigRepo.findById(configId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.revokeUser(configId, userId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining(configId.toString());
    }

    @Test
    void revokeUserIsIdempotentWhenNotAssigned() {
        var config = sampleConfig();
        when(dlqConfigRepo.findById(config.getId())).thenReturn(Optional.of(config));

        assertThatNoException().isThrownBy(() -> useCase.revokeUser(config.getId(), userId));
        verify(dlqConfigRepo).save(config);
    }

    @Test
    void revokeUserLeavesOtherAssignmentsIntact() {
        var other = UUID.randomUUID();
        var config = sampleConfig();
        config.assignUser(userId, DlqRole.OPERATOR);
        config.assignUser(other, DlqRole.VIEWER);
        when(dlqConfigRepo.findById(config.getId())).thenReturn(Optional.of(config));

        useCase.revokeUser(config.getId(), userId);

        assertThat(config.getUserAssignments()).hasSize(1);
        assertThat(config.getUserAssignments().get(0).userId()).isEqualTo(other);
    }

    // ── listForUser ───────────────────────────────────────────────────────────

    @Test
    void listForUserDelegatesToRepository() {
        var config = sampleConfig();
        when(dlqConfigRepo.findByUserId(userId)).thenReturn(List.of(config));

        var result = useCase.listForUser(userId);

        assertThat(result).containsExactly(config);
        verify(dlqConfigRepo).findByUserId(userId);
    }

    @Test
    void listForUserReturnsEmptyWhenNoAssignments() {
        when(dlqConfigRepo.findByUserId(userId)).thenReturn(List.of());

        var result = useCase.listForUser(userId);

        assertThat(result).isEmpty();
    }

    // ── createDlqConfig ───────────────────────────────────────────────────────

    @Test
    void createDlqConfigThrowsWhenClusterNotFound() {
        when(clusterRepo.findById(any())).thenReturn(Optional.empty());

        var cmd = new CreateDlqConfigCommand("orders-dlq", "Orders DLQ",
            DownloadMode.ON_DEMAND, null, 500,
            RetentionPolicy.RetentionType.MAX_AGE_DAYS, 30, null);

        assertThatThrownBy(() -> useCase.createDlqConfig(clusterId, cmd))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Cluster not found");
    }
}
