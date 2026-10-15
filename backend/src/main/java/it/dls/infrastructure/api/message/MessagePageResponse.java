package it.dls.infrastructure.api.message;

import it.dls.domain.message.MessagePage;

import it.dls.domain.message.FailureInfo;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record MessagePageResponse(
    List<MessageResponse> messages,
    long total,
    int page,
    int size
) {
    public static MessagePageResponse from(MessagePage p, Map<UUID, FailureInfo> infos) {
        return new MessagePageResponse(
            p.messages().stream().map(m -> MessageResponse.from(m, infos.get(m.getId()))).toList(),
            p.total(), p.page(), p.size()
        );
    }
}
