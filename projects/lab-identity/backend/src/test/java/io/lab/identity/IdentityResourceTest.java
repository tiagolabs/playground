package io.lab.identity;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.ClaimType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MockKeycloak.class)
public class IdentityResourceTest {
    @BeforeEach void reset(){MockKeycloak.reset();}
    @Test void anonymousSessionAndProtectedProfile(){
        given().get("/api/v1/session").then().statusCode(200).body("authenticated",is(false)).header("Cache-Control","no-store");
        given().redirects().follow(false).header("X-Requested-With","XMLHttpRequest").get("/api/v1/profile").then().statusCode(499);
    }
    @Test @TestSecurity(user=MockKeycloak.USER,roles="app-user")
    @OidcSecurity(claims={@Claim(key="aud",value="[\"lab-identity-api\"]",type=ClaimType.JSON_ARRAY),@Claim(key="sub",value=MockKeycloak.USER)})
    void memberCanReadProfileButCannotManageUsers(){
        given().get("/api/v1/profile").then().statusCode(200).body("id",is(MockKeycloak.USER));
        given().get("/api/v1/admin/users").then().statusCode(403);
        assertTrue(MockKeycloak.writes.isEmpty());
    }
    @Test @TestSecurity(user=MockKeycloak.USER)
    @OidcSecurity(claims={@Claim(key="aud",value="[\"lab-identity-api\"]",type=ClaimType.JSON_ARRAY)})
    void signedInWithoutApplicationRoleIsForbidden(){given().get("/api/v1/profile").then().statusCode(403);}
    @Test @TestSecurity(user=MockKeycloak.USER,roles="app-user")
    @OidcSecurity(claims={@Claim(key="aud",value="[\"hero-association-core\"]",type=ClaimType.JSON_ARRAY)})
    void anotherApplicationAudienceIsForbidden(){given().get("/api/v1/profile").then().statusCode(403);}
    @Test @TestSecurity(user=MockKeycloak.ADMIN,roles={"app-user","identity-admin"})
    @OidcSecurity(claims={@Claim(key="aud",value="[\"lab-identity-api\"]",type=ClaimType.JSON_ARRAY),@Claim(key="sub",value=MockKeycloak.ADMIN)})
    void mutationRequiresCsrf(){
        given().contentType("application/json").body("{\"granted\":true}").put("/api/v1/admin/users/"+MockKeycloak.USER+"/applications/hero-association").then().statusCode(400);
        assertTrue(MockKeycloak.writes.isEmpty());
    }
}
