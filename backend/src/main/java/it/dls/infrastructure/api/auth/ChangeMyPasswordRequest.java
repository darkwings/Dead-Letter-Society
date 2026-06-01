package it.dls.infrastructure.api.auth;

public record ChangeMyPasswordRequest(String currentPassword, String newPassword) {}
