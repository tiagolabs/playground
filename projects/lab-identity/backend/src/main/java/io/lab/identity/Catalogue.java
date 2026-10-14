package io.lab.identity;

import java.util.List;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotFoundException;

/** Versioned application metadata; credentials and access assignments belong to Keycloak. */
@ApplicationScoped
public class Catalogue {
    public record Application(String id, String name, String url, String roleClient, boolean available) {}
    private final List<Application> applications = List.of(
        new Application("lab-identity", "Lab Identity", "https://identity.lab.test", "lab-identity-api", true),
        new Application("hero-association", "Hero Association", "https://heroassociation.test", "hero-association", true),
        new Application("payment-integrations", "payment-integrations", "https://payments.lab.test", "payment-integrations", false));
    public List<Application> all() { return applications; }
    public Application require(String id) {
        return applications.stream().filter(a -> a.id().equals(id)).findFirst().orElseThrow(NotFoundException::new);
    }
}
