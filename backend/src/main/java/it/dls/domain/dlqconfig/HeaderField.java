package it.dls.domain.dlqconfig;

public record HeaderField(String name, HeaderEncoding encoding) {
    public HeaderField {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("header name must not be blank");
        if (encoding == null) encoding = HeaderEncoding.STRING;
    }
}
