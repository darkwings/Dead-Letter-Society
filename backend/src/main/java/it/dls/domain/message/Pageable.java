package it.dls.domain.message;

public record Pageable(int page, int size) {
    public Pageable {
        if (page < 0) throw new IllegalArgumentException("page must be >= 0");
        if (size < 1 || size > 500) throw new IllegalArgumentException("size must be 1-500");
    }
}
