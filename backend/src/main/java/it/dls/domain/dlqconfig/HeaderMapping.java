package it.dls.domain.dlqconfig;

import java.util.HashMap;
import java.util.Map;

public record HeaderMapping(
    HeaderField originalTopic,
    HeaderField originalPartition,
    HeaderField originalOffset,
    HeaderField originalTimestamp,
    HeaderField exceptionMessage,
    HeaderField exceptionStacktrace
) {
    public HeaderMapping {
        requireStringOnly("originalTopic", originalTopic);
        requireStringOnly("exceptionMessage", exceptionMessage);
        requireStringOnly("exceptionStacktrace", exceptionStacktrace);
        if (originalPartition != null && originalPartition.encoding() == HeaderEncoding.INT64)
            throw new IllegalArgumentException("originalPartition encoding must be STRING or INT32");
        reject32("originalOffset", originalOffset);
        reject32("originalTimestamp", originalTimestamp);
    }

    public static HeaderMapping empty() {
        return new HeaderMapping(null, null, null, null, null, null);
    }

    /** Header name → binary encoding, for headers that are not plain strings. */
    public Map<String, HeaderEncoding> binaryEncodings() {
        var result = new HashMap<String, HeaderEncoding>();
        for (var f : new HeaderField[]{originalPartition, originalOffset, originalTimestamp}) {
            if (f != null && f.encoding() != HeaderEncoding.STRING) result.put(f.name(), f.encoding());
        }
        return Map.copyOf(result);
    }

    private static void requireStringOnly(String field, HeaderField f) {
        if (f != null && f.encoding() != HeaderEncoding.STRING)
            throw new IllegalArgumentException(field + " encoding must be STRING");
    }

    private static void reject32(String field, HeaderField f) {
        if (f != null && f.encoding() == HeaderEncoding.INT32)
            throw new IllegalArgumentException(field + " encoding must be STRING or INT64");
    }
}
