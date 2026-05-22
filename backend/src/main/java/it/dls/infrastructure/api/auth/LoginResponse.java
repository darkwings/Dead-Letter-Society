package it.dls.infrastructure.api.auth;

public record LoginResponse(String token, UserResponse user) {}
