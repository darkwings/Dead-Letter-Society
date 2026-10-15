package it.dls.infrastructure.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.dls.domain.dlqconfig.DownloadMode;
import it.dls.domain.dlqconfig.HeaderPreset;
import it.dls.domain.dlqconfig.RetentionPolicy;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DlqConfigEntityTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private DlqConfigEntity entity(HeaderPreset preset, String mappingJson) throws Exception {
        var e = new DlqConfigEntity();
        e.id = UUID.randomUUID();
        e.clusterId = UUID.randomUUID();
        e.topicName = "t";
        e.displayName = "T";
        e.downloadMode = DownloadMode.ON_DEMAND;
        e.batchSize = 10;
        e.retentionType = RetentionPolicy.RetentionType.MAX_COUNT;
        e.retentionValue = 10;
        e.headerPreset = preset;
        e.headerMapping = mappingJson == null ? null : JSON.readTree(mappingJson);
        return e;
    }

    @Test
    void unknownPropertiesInStoredMappingAreIgnored() throws Exception {
        var e = entity(HeaderPreset.CUSTOM,
            "{\"originalTopic\":{\"name\":\"my-topic\",\"encoding\":\"STRING\"},\"futureField\":1}");
        var domain = e.toDomain();
        assertThat(domain.getHeaderMapping().originalTopic().name()).isEqualTo("my-topic");
    }

    @Test
    void unreadableStoredMappingFallsBackToPresetMappingInsteadOfFailing() throws Exception {
        var e = entity(HeaderPreset.SPRING,
            "{\"originalTopic\":{\"name\":\" \",\"encoding\":\"STRING\"}}");
        var domain = e.toDomain();
        assertThat(domain.getHeaderMapping()).isEqualTo(HeaderPreset.SPRING.mapping());
    }

    @Test
    void unreadableCustomMappingFallsBackToEmptyMapping() throws Exception {
        var e = entity(HeaderPreset.CUSTOM, "{\"originalTopic\":\"not-an-object\"}");
        var domain = e.toDomain();
        assertThat(domain.getHeaderMapping().originalTopic()).isNull();
    }
}
