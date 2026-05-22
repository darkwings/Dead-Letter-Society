package it.dls.domain.dlqconfig;

import java.util.UUID;

public record UserAssignment(UUID userId, DlqRole role) {}
