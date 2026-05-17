package it.dls.infrastructure.security;

import it.dls.application.identity.PasswordHashPort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class BcryptPasswordHashAdapter implements PasswordHashPort {

    @Override
    public String hash(String plaintext) {
        return io.quarkus.elytron.security.common.BcryptUtil.bcryptHash(plaintext);
    }

    @Override
    public boolean verify(String plaintext, String hash) {
        try {
            return io.quarkus.elytron.security.common.BcryptUtil.matches(plaintext, hash);
        } catch (Exception e) {
            return false;
        }
    }
}
