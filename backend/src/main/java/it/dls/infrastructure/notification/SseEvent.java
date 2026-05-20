package it.dls.infrastructure.notification;

import java.util.UUID;

public record SseEvent(String type, UUID dlqConfigId, String payload) {

    static SseEvent fetchCompleted(UUID dlqConfigId, int count) {
        return new SseEvent("FETCH_COMPLETED", dlqConfigId,
            "{\"dlqConfigId\":\"" + dlqConfigId + "\",\"newMessagesCount\":" + count + "}");
    }

    static SseEvent fetchFailed(UUID dlqConfigId, String error) {
        return new SseEvent("FETCH_FAILED", dlqConfigId,
            "{\"dlqConfigId\":\"" + dlqConfigId + "\",\"error\":\"" + escape(error) + "\"}");
    }

    static SseEvent noteAdded(UUID messageId, UUID dlqConfigId) {
        return new SseEvent("NOTE_ADDED", dlqConfigId,
            "{\"messageId\":\"" + messageId + "\",\"dlqConfigId\":\"" + dlqConfigId + "\"}");
    }

    static SseEvent messageStatusChanged(UUID messageId, UUID dlqConfigId, String status) {
        return new SseEvent("MESSAGE_STATUS_CHANGED", dlqConfigId,
            "{\"messageId\":\"" + messageId + "\",\"dlqConfigId\":\"" + dlqConfigId
                + "\",\"status\":\"" + status + "\"}");
    }

    public String toJson() {
        return "{\"type\":\"" + type + "\",\"data\":" + payload + "}";
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
