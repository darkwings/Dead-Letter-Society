package it.dls.infrastructure.api.replay;

public record ValidatePayloadResponse(boolean valid, String error) {}
