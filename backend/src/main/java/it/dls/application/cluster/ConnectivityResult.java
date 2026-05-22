package it.dls.application.cluster;

public record ConnectivityResult(boolean success, String errorMessage) {
    public static ConnectivityResult ok() { return new ConnectivityResult(true, null); }
    public static ConnectivityResult fail(String msg) { return new ConnectivityResult(false, msg); }
}
