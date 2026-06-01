package it.dls.infrastructure.api.auth;

public record SetupStatusResponse(boolean setupRequired, boolean oidcEnabled) {}
