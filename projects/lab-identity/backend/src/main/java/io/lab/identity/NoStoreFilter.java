package io.lab.identity;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

@Provider
public class NoStoreFilter implements ContainerResponseFilter {
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        if (request.getUriInfo().getPath().replaceFirst("^/", "").startsWith("api/")) {
            response.getHeaders().putSingle("Cache-Control","no-store");
            response.getHeaders().putSingle("X-Content-Type-Options","nosniff");
        }
    }
}
