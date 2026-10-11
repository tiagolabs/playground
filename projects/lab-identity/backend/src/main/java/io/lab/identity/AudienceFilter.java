package io.lab.identity;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

/** The code-flow access token is verified by OIDC and must target this API. */
@Provider
public class AudienceFilter implements ContainerRequestFilter {
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken accessToken;
    public void filter(ContainerRequestContext request) {
        if (!identity.isAnonymous() && request.getUriInfo().getPath().replaceFirst("^/", "").startsWith("api/")
                && !accessToken.getAudience().contains("lab-identity-api")) {
            request.abortWith(Response.status(403).build());
        }
    }
}
