package it.dls.domain.dlqconfig;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

class HeaderMappingTest {

    @Test
    void emptyMappingHasNoFields() {
        var m = HeaderMapping.empty();
        assertThat(m.originalTopic()).isNull();
        assertThat(m.binaryEncodings()).isEmpty();
    }

    @Test
    void binaryEncodingsListsOnlyNonStringFields() {
        var m = new HeaderMapping(
            new HeaderField("t", HeaderEncoding.STRING),
            new HeaderField("p", HeaderEncoding.INT32),
            new HeaderField("o", HeaderEncoding.INT64),
            null, null, null);
        assertThat(m.binaryEncodings())
            .isEqualTo(Map.of("p", HeaderEncoding.INT32, "o", HeaderEncoding.INT64));
    }

    @Test
    void headerFieldRejectsBlankName() {
        assertThatThrownBy(() -> new HeaderField(" ", HeaderEncoding.STRING))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void headerFieldNullEncodingDefaultsToString() {
        assertThat(new HeaderField("x", null).encoding()).isEqualTo(HeaderEncoding.STRING);
    }

    @Test
    void originalTopicMustBeString() {
        assertThatThrownBy(() -> new HeaderMapping(
            new HeaderField("t", HeaderEncoding.INT32), null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("originalTopic");
    }

    @Test
    void partitionCannotBeInt64() {
        assertThatThrownBy(() -> new HeaderMapping(
            null, new HeaderField("p", HeaderEncoding.INT64), null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("originalPartition");
    }

    @Test
    void offsetAndTimestampCannotBeInt32() {
        assertThatThrownBy(() -> new HeaderMapping(
            null, null, new HeaderField("o", HeaderEncoding.INT32), null, null, null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("originalOffset");
        assertThatThrownBy(() -> new HeaderMapping(
            null, null, null, new HeaderField("ts", HeaderEncoding.INT32), null, null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("originalTimestamp");
    }
}
