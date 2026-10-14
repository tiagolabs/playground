package io.lab.identity;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.*;
import org.junit.jupiter.api.*;
import io.restassured.specification.RequestSpecification;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MockKeycloak.class)
@TestSecurity(user=MockKeycloak.ADMIN,roles={"app-user","identity-admin"})
@OidcSecurity(claims={@Claim(key="aud",value="[\"lab-identity-api\"]",type=ClaimType.JSON_ARRAY),@Claim(key="sub",value=MockKeycloak.ADMIN)})
public class AdminWorkflowTest {
    String csrf,cookie;
    @BeforeEach void setup(){
        MockKeycloak.reset();var session=given().get("/api/v1/session").then().statusCode(200).extract();
        csrf=session.path("csrfToken");cookie=session.cookie("lab-identity-csrf");
    }
    RequestSpecification mutation(){return given().contentType("application/json").cookie("lab-identity-csrf",cookie).header("X-CSRF-TOKEN",csrf);}
    @Test void newUserHasOnlyDefaultSelfServiceAndNoPasswordInApp(){
        mutation().body("{\"username\":\"new-user\",\"email\":\"new@example.test\",\"firstName\":\"New\",\"lastName\":\"User\"}").post("/api/v1/admin/users").then().statusCode(201);
        assertFalse(MockKeycloak.lastCreated.has("credentials"));assertFalse(MockKeycloak.lastCreated.has("clientRoles"));
        given().get("/api/v1/admin/users/"+MockKeycloak.USER).then().statusCode(200).body("applications.find { it.id == 'hero-association' }.granted",is(false)).body("applications.find { it.id == 'lab-identity' }.granted",is(true));
    }
    @Test void grantsAreIndependentAndRevocationEndsSessions(){
        String path="/api/v1/admin/users/"+MockKeycloak.USER+"/applications/";
        mutation().body("{\"granted\":true}").put(path+"hero-association").then().statusCode(204);
        mutation().body("{\"granted\":true}").put(path+"payment-integrations").then().statusCode(204);
        mutation().body("{\"granted\":false}").put(path+"hero-association").then().statusCode(204);
        given().get("/api/v1/admin/users/"+MockKeycloak.USER).then().statusCode(200).body("applications.find { it.id == 'hero-association' }.granted",is(false)).body("applications.find { it.id == 'payment-integrations' }.granted",is(true));
        assertTrue(MockKeycloak.writes.contains("POST /users/"+MockKeycloak.USER+"/logout"));
    }
    @Test void arbitraryClientAndSelfServiceRevocationAreRejected(){
        mutation().body("{\"granted\":true}").put("/api/v1/admin/users/"+MockKeycloak.USER+"/applications/realm-management").then().statusCode(404);
        mutation().body("{\"granted\":false}").put("/api/v1/admin/users/"+MockKeycloak.ADMIN+"/applications/lab-identity").then().statusCode(400);
        assertTrue(MockKeycloak.writes.isEmpty());
    }
    @Test void administratorCannotDisableTheirOwnAccount(){
        mutation().body("{\"email\":\"admin@example.test\",\"firstName\":\"Lab\",\"lastName\":\"Admin\",\"enabled\":false}").put("/api/v1/admin/users/"+MockKeycloak.ADMIN).then().statusCode(409);
        assertTrue(MockKeycloak.writes.isEmpty());
    }
    @Test void duplicateUserAndUpstreamMailFailureAreSafe(){
        mutation().body("{\"username\":\"member\",\"email\":\"member@example.test\",\"firstName\":\"Lab\",\"lastName\":\"User\"}").post("/api/v1/admin/users").then().statusCode(409);
        MockKeycloak.mailFails=true;
        mutation().post("/api/v1/admin/users/"+MockKeycloak.USER+"/password-reset").then().statusCode(502).body("message",is("Identity service is unavailable")).body(not(containsString("upstream-private-material")));
    }
}
