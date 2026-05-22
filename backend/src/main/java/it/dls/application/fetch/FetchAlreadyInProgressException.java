package it.dls.application.fetch;

import java.util.UUID;

public class FetchAlreadyInProgressException extends RuntimeException {
    public FetchAlreadyInProgressException(UUID dlqConfigId) {
        super("Fetch already in progress for DLQ config: " + dlqConfigId);
    }
}
