package it.dls.application.replay;

import java.util.UUID;

public class ReplayTopicNotResolvableException extends RuntimeException {
    public ReplayTopicNotResolvableException(UUID messageId) {
        super("Cannot resolve replay topic for message " + messageId +
              ": no wizard override, no config default, and no x-original-topic header");
    }
}
