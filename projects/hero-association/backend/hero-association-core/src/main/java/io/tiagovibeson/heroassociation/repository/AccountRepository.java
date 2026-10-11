package io.tiagovibeson.heroassociation.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.tiagovibeson.heroassociation.domain.Account;
import io.tiagovibeson.heroassociation.domain.UuidV7;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AccountRepository implements PanacheRepositoryBase<Account, UUID> {

    public Optional<Account> findByKeycloakSubject(String keycloakSubject) {
        return find("keycloakSubject", keycloakSubject).firstResultOptional();
    }

    /** PostgreSQL serializes competing inserts through the unique subject constraint. */
    public Account provisionIfAbsent(String subject, String email, boolean verified) {
        getEntityManager().createNativeQuery("""
                INSERT INTO account (id, keycloak_subject, email, email_verified, status, created_at, last_login_at)
                VALUES (:id, :subject, :email, :verified, 'ACTIVE', :now, :now)
                ON CONFLICT (keycloak_subject) DO NOTHING
                """)
                .setParameter("id", UuidV7.next())
                .setParameter("subject", subject)
                .setParameter("email", email)
                .setParameter("verified", verified)
                .setParameter("now", Instant.now())
                .executeUpdate();
        return findByKeycloakSubject(subject).orElseThrow();
    }

}
