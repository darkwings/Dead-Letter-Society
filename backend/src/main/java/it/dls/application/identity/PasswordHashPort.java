package it.dls.application.identity;

public interface PasswordHashPort {
    String hash(String plaintext);
    boolean verify(String plaintext, String hash);
}
