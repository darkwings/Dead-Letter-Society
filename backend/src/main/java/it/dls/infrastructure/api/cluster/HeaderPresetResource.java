package it.dls.infrastructure.api.cluster;

import it.dls.domain.dlqconfig.HeaderMapping;
import it.dls.domain.dlqconfig.HeaderPreset;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.Arrays;
import java.util.List;

@Path("/api/header-presets")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "USER"})
public class HeaderPresetResource {

    public record PresetResponse(HeaderPreset preset, HeaderMapping mapping) {}

    @GET
    public List<PresetResponse> list() {
        return Arrays.stream(HeaderPreset.values())
            .filter(p -> p != HeaderPreset.CUSTOM)
            .map(p -> new PresetResponse(p, p.mapping()))
            .toList();
    }
}
