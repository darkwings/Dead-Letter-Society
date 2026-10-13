package it.dls.application.inspection;

import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.FailureInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FailureInfoAssemblerTest {

    DlqConfigRepository repo = mock(DlqConfigRepository.class);
    FailureInfoAssembler assembler = new FailureInfoAssembler(repo);

    private DlqConfig config(HeaderPreset preset) {
        var c = DlqConfig.create(UUID.randomUUID(), "t", "T",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        c.changeHeaderMapping(preset, null);
        return c;
    }

    private DlqMessage message(UUID configId, Map<String, String> headers) {
        return DlqMessage.ingest(configId, 0, 0L, Instant.now(), null, new byte[]{1}, null, null, headers, false);
    }

    @Test
    void usesEachMessagesConfigMapping() {
        var spring = config(HeaderPreset.SPRING);
        var legacy = config(HeaderPreset.LEGACY);
        when(repo.findById(spring.getId())).thenReturn(Optional.of(spring));
        when(repo.findById(legacy.getId())).thenReturn(Optional.of(legacy));
        var m1 = message(spring.getId(), Map.of("kafka_dlt-original-topic", "a"));
        var m2 = message(legacy.getId(), Map.of("x-original-topic", "b"));
        var result = assembler.assembleAll(List.of(m1, m2));
        assertThat(result.get(m1.getId()).originalTopic()).isEqualTo("a");
        assertThat(result.get(m2.getId()).originalTopic()).isEqualTo("b");
    }

    @Test
    void loadsEachConfigOnce() {
        var c = config(HeaderPreset.LEGACY);
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        assembler.assembleAll(List.of(message(c.getId(), Map.of()), message(c.getId(), Map.of())));
        verify(repo, times(1)).findById(c.getId());
    }

    @Test
    void missingConfigYieldsEmptyInfo() {
        var missing = UUID.randomUUID();
        when(repo.findById(missing)).thenReturn(Optional.empty());
        var m = message(missing, Map.of("x-original-topic", "a"));
        assertThat(assembler.assembleAll(List.of(m)).get(m.getId())).isEqualTo(FailureInfo.empty());
    }

    @Test
    void messageWithNoHeadersYieldsEmptyInfo() {
        var c = config(HeaderPreset.SPRING);
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        var m = message(c.getId(), Map.of());
        assertThat(assembler.assembleAll(List.of(m)).get(m.getId())).isEqualTo(FailureInfo.empty());
    }
}
