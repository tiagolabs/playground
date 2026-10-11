package io.lab.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Restricted service account. Never expose token material or upstream response bodies. */
@ApplicationScoped
public class KeycloakClient {
    @Inject ObjectMapper mapper;
    @ConfigProperty(name="lab.keycloak.url") String server;
    @ConfigProperty(name="lab.keycloak.admin-secret") String secret;
    @ConfigProperty(name="lab.keycloak.realm", defaultValue="lab") String realm;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private String token;
    private Instant tokenExpires = Instant.EPOCH;

    static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private synchronized String token() {
        if (token != null && Instant.now().isBefore(tokenExpires)) return token;
        var request = HttpRequest.newBuilder(URI.create(server+"/realms/"+realm+"/protocol/openid-connect/token"))
            .timeout(Duration.ofSeconds(10)).header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials&client_id=lab-identity-admin&client_secret="+encode(secret))).build();
        var response = send(request);
        if (response.statusCode() != 200) throw failure(502, "Identity service is unavailable");
        var body = parse(response.body());
        token = body.path("access_token").asText();
        if (token.isBlank()) throw failure(502, "Identity service is unavailable");
        tokenExpires = Instant.now().plusSeconds(Math.max(1, body.path("expires_in").asLong(60)-15));
        return token;
    }
    public JsonNode request(String method, String path, JsonNode body) {
        for (int attempt=0; attempt<2; attempt++) {
            var builder = HttpRequest.newBuilder(URI.create(server+"/admin/realms/"+realm+path)).timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer "+token()).header("Content-Type", "application/json");
            var response = send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body.toString())).build());
            int status = response.statusCode();
            if (status==401 && attempt==0) { synchronized(this) {token=null; tokenExpires=Instant.EPOCH;} continue; }
            if (status==404) throw failure(404, "User or application does not exist");
            if (status==409) throw failure(409, "Username or email already exists");
            if (status==400) throw failure(400, "Identity service rejected the request");
            if (status<200 || status>=300) throw failure(502, "Identity service is unavailable");
            return response.body().isBlank() ? mapper.nullNode() : parse(response.body());
        }
        throw failure(502, "Identity service is unavailable");
    }
    private HttpResponse<String> send(HttpRequest request) {
        try { return http.send(request, HttpResponse.BodyHandlers.ofString()); }
        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw failure(503,"Identity service is unavailable"); }
        catch (java.io.IOException unavailable) { throw failure(503,"Identity service is unavailable"); }
    }
    private JsonNode parse(String body) {
        try { return mapper.readTree(body); }
        catch (java.io.IOException invalid) { throw failure(502,"Identity service returned an invalid response"); }
    }
    static WebApplicationException failure(int status, String message) {
        return new WebApplicationException(jakarta.ws.rs.core.Response.status(status).entity(Map.of("message",message)).build());
    }
    public ObjectNode object() { return mapper.createObjectNode(); }
    public ArrayNode array() { return mapper.createArrayNode(); }
    public String clientId(Catalogue.Application app) {
        var clients = request("GET", "/clients?clientId="+encode(app.roleClient()), null);
        if (!clients.isArray() || clients.size()!=1) throw failure(502,"Application identity configuration is unavailable");
        return clients.get(0).path("id").asText();
    }
    public boolean hasAccess(String subject, Catalogue.Application app) {
        var roles = request("GET", "/users/"+subject+"/role-mappings/clients/"+clientId(app)+"/composite", null);
        for (var role: roles) if ("app-user".equals(role.path("name").asText())) return true;
        return false;
    }
}
