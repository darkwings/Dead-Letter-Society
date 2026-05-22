package it.dls.application.replay;

public class SchemaValidationException extends RuntimeException {
    public SchemaValidationException(String error) {
        super("Schema validation failed: " + error);
    }
}
