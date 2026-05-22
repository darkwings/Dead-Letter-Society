package it.dls.application.fetch;

public record FetchResult(int count) {
    public static FetchResult of(int count) { return new FetchResult(count); }
}
