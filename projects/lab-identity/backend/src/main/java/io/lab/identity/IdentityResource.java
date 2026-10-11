package io.lab.identity;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;
import static io.lab.identity.IdentityService.*;

@Path("/api/v1")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class IdentityResource {
    @Inject SecurityIdentity identity;
    @Inject RoutingContext context;
    @Inject IdentityService service;
    String subject() { return identity.getPrincipal() instanceof JsonWebToken jwt ? jwt.getSubject() : identity.getPrincipal().getName(); }
    @GET @Path("session")
    public Response session() {
        return Response.ok(new Session(!identity.isAnonymous(),identity.hasRole("app-user"),identity.hasRole("identity-admin"),
            identity.isAnonymous() ? null : subject(),context.get("csrf_token"))).header("Cache-Control","no-store").build();
    }
    record Session(boolean authenticated, boolean appUser, boolean admin, String subject, String csrfToken) {}
    @GET @Path("profile") @RolesAllowed("app-user")
    public Profile profile() { return service.profile(subject()); }
    @PUT @Path("profile") @RolesAllowed("app-user")
    public Profile profile(ProfileInput input) {
        if (input==null) throw KeycloakClient.failure(400,"Profile details are required");
        return service.updateProfile(subject(),input.email(),input.firstName(),input.lastName(),null,subject());
    }
    @GET @Path("applications") @RolesAllowed("app-user")
    public List<ApplicationView> applications() { return service.applications(subject()); }
    @GET @Path("admin/users") @RolesAllowed("identity-admin")
    public List<Profile> users(@QueryParam("search") String search, @QueryParam("first") @DefaultValue("0") int first, @QueryParam("max") @DefaultValue("50") int max) {
        return service.search(search,first,max);
    }
    @POST @Path("admin/users") @RolesAllowed("identity-admin")
    public Response create(CreateUser input) { return Response.status(201).entity(service.create(subject(),input)).build(); }
    @GET @Path("admin/users/{id}") @RolesAllowed("identity-admin")
    public UserDetail detail(@PathParam("id") String id) { return new UserDetail(service.profile(id),service.applications(id)); }
    @PUT @Path("admin/users/{id}") @RolesAllowed("identity-admin")
    public Profile update(@PathParam("id") String id, UpdateUser input) {
        if (input==null) throw KeycloakClient.failure(400,"User details are required");
        return service.updateProfile(subject(),input.email(),input.firstName(),input.lastName(),input.enabled(),id);
    }
    @PUT @Path("admin/users/{id}/applications/{app}") @RolesAllowed("identity-admin")
    public Response grant(@PathParam("id") String id,@PathParam("app") String app, Grant input) {
        if (input==null || input.granted()==null) throw KeycloakClient.failure(400,"Application access is required");
        service.grant(subject(),id,app,input.granted()); return Response.noContent().build();
    }
    @POST @Path("admin/users/{id}/password-reset") @RolesAllowed("identity-admin")
    public Response reset(@PathParam("id") String id) { service.passwordReset(subject(),id); return Response.noContent().build(); }
}
