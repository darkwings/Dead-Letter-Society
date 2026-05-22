package it.dls.infrastructure.api.auth;

public record CreateAdminRequest(String email, String displayName, String password) {}
