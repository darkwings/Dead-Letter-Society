package it.dls.application.fetch;

import it.dls.domain.dlqconfig.HeaderEncoding;
import it.dls.domain.dlqconfig.HeaderMapping;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/** Converts raw Kafka header bytes to the string map persisted on DlqMessage. */
public class HeaderDecoder {

    public Map<String, String> decode(Map<String, byte[]> raw, HeaderMapping mapping) {
        var out = new HashMap<String, String>();
        if (raw == null) return out;
        var binary = mapping == null ? Map.<String, HeaderEncoding>of() : mapping.binaryEncodings();
        raw.forEach((name, bytes) -> {
            if (bytes == null) return;
            out.put(name, decodeValue(bytes, binary.get(name)));
        });
        return out;
    }

    private static String decodeValue(byte[] bytes, HeaderEncoding encoding) {
        if (encoding == HeaderEncoding.INT32 && bytes.length == Integer.BYTES)
            return Integer.toString(ByteBuffer.wrap(bytes).getInt());
        if (encoding == HeaderEncoding.INT64 && bytes.length == Long.BYTES)
            return Long.toString(ByteBuffer.wrap(bytes).getLong());
        if (encoding != null && encoding != HeaderEncoding.STRING)
            return Base64.getEncoder().encodeToString(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
