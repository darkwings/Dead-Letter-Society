package it.dls.infrastructure.api.cluster;

import it.dls.domain.dlqconfig.DlqRole;

import java.util.UUID;

public record AssignUserRequest(UUID userId, DlqRole role) {}
