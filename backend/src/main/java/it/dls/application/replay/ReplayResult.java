package it.dls.application.replay;

public record ReplayResult(boolean success, String targetTopic, String failureReason) {

    public static ReplayResult success(String targetTopic) {
        return new ReplayResult(true, targetTopic, null);
    }

    public static ReplayResult failure(String reason) {
        return new ReplayResult(false, null, reason);
    }
}
