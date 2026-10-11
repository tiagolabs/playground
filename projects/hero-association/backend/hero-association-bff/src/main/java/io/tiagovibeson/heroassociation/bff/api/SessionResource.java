package io.tiagovibeson.heroassociation.bff.api;

import org.eclipse.microprofile.jwt.JsonWebToken;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.ext.web.RoutingContext;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/session")
@Produces(MediaType.APPLICATION_JSON)
public class SessionResource {

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "hero-association.self-registration.enabled", defaultValue = "false")
    boolean registrationAllowed;

    @Inject
    SecurityIdentity identity;

    @Inject
    RoutingContext routingContext;

    @GET
    public Response session() {
        if (identity.isAnonymous()) {
            return noStore(SessionResponse.anonymous(csrfToken(), registrationAllowed));
        }

        if (identity.getPrincipal() instanceof JsonWebToken token) {
            return noStore(SessionResponse.authenticated(new IdentityResponse(
                    token.getSubject(),
                    token.getClaim("preferred_username"),
                    token.getClaim("email"),
                    Boolean.TRUE.equals(token.getClaim("email_verified"))), csrfToken(), registrationAllowed));
        }

        return noStore(SessionResponse.authenticated(new IdentityResponse(
                identity.getPrincipal().getName(),
                identity.getPrincipal().getName(),
                null,
                false), csrfToken(), registrationAllowed));
    }

    private String csrfToken() {
        return routingContext.get("csrf_token");
    }

    private Response noStore(SessionResponse session) {
        return Response.ok(session)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .build();
    }

    public record SessionResponse(boolean authenticated, IdentityResponse identity, String csrfToken, boolean registrationAllowed) {

        static SessionResponse anonymous(String csrfToken, boolean registrationAllowed) {
            return new SessionResponse(false, null, csrfToken, registrationAllowed);
        }

        static SessionResponse authenticated(IdentityResponse identity, String csrfToken, boolean registrationAllowed) {
            return new SessionResponse(true, identity, csrfToken, registrationAllowed);
        }
    }

    public record IdentityResponse(
            String subject,
            String username,
            String email,
            boolean emailVerified) {
    }
}
