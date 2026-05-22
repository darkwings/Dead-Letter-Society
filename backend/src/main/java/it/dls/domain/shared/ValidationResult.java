package it.dls.domain.shared;

public record ValidationResult(boolean valid, String error) {
    public static ValidationResult ok() { return new ValidationResult(true, null); }
    public static ValidationResult fail(String error) { return new ValidationResult(false, error); }
}
