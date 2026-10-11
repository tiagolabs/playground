package io.lab.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class IdentityService {
    private static final Logger LOG = Logger.getLogger(IdentityService.class);
    @Inject KeycloakClient keycloak;
    @Inject Catalogue catalogue;
    public record Profile(String id, String username, String email, String firstName, String lastName, boolean enabled, boolean emailVerified) {}
    public record ProfileInput(String email, String firstName, String lastName) {}
    public record CreateUser(String username, String email, String firstName, String lastName) {}
    public record UpdateUser(String email, String firstName, String lastName, Boolean enabled) {}
    public record Grant(Boolean granted) {}
    public record ApplicationView(String id, String name, String url, boolean available, boolean granted) {}
    public record UserDetail(Profile profile, List<ApplicationView> applications) {}
    static String subject(String id) {
        try { return UUID.fromString(id).toString(); }
        catch (RuntimeException invalid) { throw KeycloakClient.failure(400,"Invalid user identifier"); }
    }
    JsonNode user(String id) {
        var user = keycloak.request("GET", "/users/"+subject(id), null);
        if (user.hasNonNull("serviceAccountClientId") || user.path("username").asText().startsWith("service-account-"))
            throw KeycloakClient.failure(404,"User does not exist");
        return user;
    }
    private Profile profile(JsonNode node) {
        return new Profile(node.path("id").asText(),node.path("username").asText(),node.path("email").asText(),
            node.path("firstName").asText(),node.path("lastName").asText(),node.path("enabled").asBoolean(),node.path("emailVerified").asBoolean());
    }
    public Profile profile(String subject) { return profile(user(subject)); }
    public List<Profile> search(String search, int first, int max) {
        if (first<0 || max<1 || max>100 || (search!=null && search.length()>100)) throw KeycloakClient.failure(400,"Invalid search parameters");
        var users = keycloak.request("GET", "/users?first="+first+"&max="+max+"&search="+KeycloakClient.encode(search==null ? "" : search),null);
        var result = new ArrayList<Profile>();
        for (var user: users) if (!user.hasNonNull("serviceAccountClientId") && !user.path("username").asText().startsWith("service-account-")) result.add(profile(user));
        return result;
    }
    public List<ApplicationView> applications(String id) {
        String target = subject(id); user(target);
        return catalogue.all().stream().map(a -> new ApplicationView(a.id(),a.name(),a.url(),a.available(),keycloak.hasAccess(target,a))).toList();
    }
    private static String field(String value, int max) {
        if (value==null || value.isBlank() || value.strip().length()>max || value.chars().anyMatch(c->Character.isISOControl(c)))
            throw KeycloakClient.failure(400,"Complete all profile fields with valid values");
        return value.strip();
    }
    private ObjectNode fields(String email, String firstName, String lastName) {
        email = field(email,254);
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw KeycloakClient.failure(400,"Enter a valid email address");
        return keycloak.object().put("email",email).put("firstName",field(firstName,100)).put("lastName",field(lastName,100));
    }
    public Profile updateProfile(String actor, String email, String first, String last, Boolean enabled, String id) {
        String target=subject(id); var old=user(target);
        if (target.equals(subject(actor)) && Boolean.FALSE.equals(enabled)) throw KeycloakClient.failure(409,"You cannot disable your own account");
        var update=fields(email,first,last);
        if (!old.path("email").asText().equals(update.path("email").asText())) update.put("emailVerified",false);
        if (enabled!=null) update.put("enabled",enabled);
        keycloak.request("PUT","/users/"+target,update);
        if (Boolean.FALSE.equals(enabled)) keycloak.request("POST","/users/"+target+"/logout",null);
        LOG.infof("User profile updated: actor=%s target=%s", subject(actor), target);
        return profile(target);
    }
    public Profile create(String actor, CreateUser input) {
        if (input==null) throw KeycloakClient.failure(400,"User details are required");
        String name=field(input.username(),100);
        if (!name.matches("[A-Za-z0-9][A-Za-z0-9._-]*") || name.startsWith("service-account-")) throw KeycloakClient.failure(400,"Invalid username");
        var body=fields(input.email(),input.firstName(),input.lastName()).put("username",name).put("enabled",true).put("emailVerified",false);
        body.putArray("requiredActions").add("UPDATE_PASSWORD");
        keycloak.request("POST","/users",body);
        var users=keycloak.request("GET","/users?username="+KeycloakClient.encode(name)+"&exact=true",null);
        if (users.size()!=1) throw KeycloakClient.failure(502,"Could not locate the created user");
        String target=subject(users.get(0).path("id").asText());
        LOG.infof("User created: actor=%s target=%s", subject(actor),target);
        return profile(users.get(0));
    }
    public void grant(String actor, String id, String application, boolean granted) {
        String target=subject(id); user(target); var app=catalogue.require(application);
        if (app.id().equals("lab-identity")) throw KeycloakClient.failure(400,"Lab Identity self-service access is the default account entitlement");
        String client=keycloak.clientId(app);
        var role=keycloak.request("GET","/clients/"+client+"/roles/app-user",null);
        keycloak.request(granted ? "POST" : "DELETE", "/users/"+target+"/role-mappings/clients/"+client,keycloak.array().add(role));
        // Force fresh claims across SSO clients. Already issued JWTs expire within 60 seconds.
        keycloak.request("POST","/users/"+target+"/logout",null);
        LOG.infof("Application access changed: actor=%s target=%s app=%s granted=%s",subject(actor),target,app.id(),granted);
    }
    public void passwordReset(String actor, String id) {
        String target=subject(id); user(target);
        keycloak.request("PUT","/users/"+target+"/execute-actions-email?client_id=lab-identity&redirect_uri="+KeycloakClient.encode("https://identity.lab.test/")+"&lifespan=1800",keycloak.array().add("UPDATE_PASSWORD"));
        LOG.infof("Password reset email requested: actor=%s target=%s",subject(actor),target);
    }
}
