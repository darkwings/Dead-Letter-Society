package it.dls.infrastructure.api.message;

import it.dls.domain.message.MessagePage;

import java.util.List;

public record MessagePageResponse(
    List<MessageResponse> messages,
    long total,
    int page,
    int size
) {
    public static MessagePageResponse from(MessagePage p) {
        return new MessagePageResponse(
            p.messages().stream().map(MessageResponse::from).toList(),
            p.total(), p.page(), p.size()
        );
    }
}
