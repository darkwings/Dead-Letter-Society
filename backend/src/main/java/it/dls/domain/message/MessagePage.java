package it.dls.domain.message;

import java.util.List;

public record MessagePage(List<DlqMessage> messages, long total, int page, int size) {}
