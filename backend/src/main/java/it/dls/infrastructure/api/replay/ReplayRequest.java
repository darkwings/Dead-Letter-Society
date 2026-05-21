package it.dls.infrastructure.api.replay;

import com.fasterxml.jackson.databind.JsonNode;

public record ReplayRequest(String targetTopicOverride, JsonNode editedPayload) {}
