package it.dls.domain.shared;

public interface EncryptionPort {
    String encrypt(String plaintext);
    String decrypt(String ciphertext);
}
