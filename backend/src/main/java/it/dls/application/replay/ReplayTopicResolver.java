package it.dls.application.replay;

import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.message.DlqMessage;

public class ReplayTopicResolver {

    private static final String ORIGINAL_TOPIC_HEADER = "x-original-topic";

    public String resolve(DlqMessage message, DlqConfig config, String wizardOverride) {
        if (wizardOverride != null && !wizardOverride.isBlank()) return wizardOverride;
        if (config.getDefaultReplayTopic() != null) return config.getDefaultReplayTopic();
        var header = message.getHeaders().get(ORIGINAL_TOPIC_HEADER);
        if (header != null) return header;
        throw new ReplayTopicNotResolvableException(message.getId());
    }
}
