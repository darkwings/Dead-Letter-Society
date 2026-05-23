package it.dls.infrastructure.api.message;

import java.util.List;
import java.util.UUID;

public record BulkReplayRequest(List<UUID> messageIds) {}
