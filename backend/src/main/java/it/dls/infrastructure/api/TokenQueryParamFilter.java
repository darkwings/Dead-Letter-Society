package it.dls.infrastructure.api;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;

/**
 * Moves ?token=<jwt> query param into Authorization: Bearer header.
 * Required for EventSource (SSE) which cannot set custom headers.
 */
@Provider
public class TokenQueryParamFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext ctx) {
        if (ctx.getHeaders().containsKey("Authorization")) return;
        String token = ctx.getUriInfo().getQueryParameters().getFirst("token");
        if (token != null && !token.isBlank()) {
            ctx.getHeaders().putSingle("Authorization", "Bearer " + token);
        }
    }
}
