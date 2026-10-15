package it.dls.application.inspection;

import it.dls.domain.dlqconfig.HeaderField;
import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.message.FailureInfo;

import java.time.Instant;
import java.util.Map;

/** Derives a normalized FailureInfo from stored (string) headers. Never throws on bad values. */
public class FailureInfoExtractor {

    public FailureInfo extract(Map<String, String> headers, HeaderMapping mapping) {
        if (headers == null || mapping == null) return FailureInfo.empty();
        return new FailureInfo(
            text(headers, mapping.originalTopic()),
            toInt(text(headers, mapping.originalPartition())),
            toLong(text(headers, mapping.originalOffset())),
            toInstant(text(headers, mapping.originalTimestamp())),
            text(headers, mapping.exceptionMessage()),
            text(headers, mapping.exceptionStacktrace()));
    }

    private static String text(Map<String, String> headers, HeaderField f) {
        return f == null ? null : headers.get(f.name());
    }

    private static Integer toInt(String s) {
        if (s == null) return null;
        try { return Integer.valueOf(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Long toLong(String s) {
        if (s == null) return null;
        try { return Long.valueOf(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Instant toInstant(String s) {
        if (s == null) return null;
        var n = toLong(s);
        if (n != null) return Instant.ofEpochMilli(n);
        try { return Instant.parse(s.trim()); } catch (Exception e) { return null; }
    }
}
