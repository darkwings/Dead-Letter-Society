package it.dls.application.replay;

import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.message.DlqMessage;

public class ReplayTopicResolver {

    public String resolve(DlqMessage message, DlqConfig config, String wizardOverride) {
        if (wizardOverride != null && !wizardOverride.isBlank()) return wizardOverride.strip();
        if (config.getDefaultReplayTopic() != null) return config.getDefaultReplayTopic();
        var field = config.getHeaderMapping().originalTopic();
        if (field != null) {
            var header = message.getHeaders().get(field.name());
            if (header != null && !header.isBlank()) return header.strip();
        }
        throw new ReplayTopicNotResolvableException(message.getId());
    }
}
