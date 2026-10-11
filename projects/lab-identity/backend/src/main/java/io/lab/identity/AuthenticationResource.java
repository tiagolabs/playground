package io.lab.identity;

import io.quarkus.security.Authenticated;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.Response;
import java.net.URI;

@Path("/auth")
public class AuthenticationResource {
    private Response home() { return Response.seeOther(URI.create("https://identity.lab.test")).build(); }
    @GET @Path("login") @Authenticated public Response login() { return home(); }
    @GET @Path("logout") public Response logout() { return home(); }
    @GET @Path("post-logout") public Response postLogout(@QueryParam("state") String state,@CookieParam("q_post_logout") Cookie cookie) {
        if (state==null || cookie==null || !state.equals(cookie.getValue())) return Response.status(400).build();
        return home();
    }
}
