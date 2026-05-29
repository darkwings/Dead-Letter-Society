package it.dls.application.identity;

import java.util.List;
import java.util.Map;

public record OidcClaims(Map<String, List<String>> multiValueClaims) {

    public static OidcClaims empty() {
        return new OidcClaims(Map.of());
    }

    public List<String> getValues(String claimName) {
        return multiValueClaims.getOrDefault(claimName, List.of());
    }
}
