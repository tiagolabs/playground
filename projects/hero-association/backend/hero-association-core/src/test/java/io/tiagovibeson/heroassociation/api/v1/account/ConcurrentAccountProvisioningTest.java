package io.tiagovibeson.heroassociation.api.v1.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(user = "concurrent-first-lab-login", roles = "app-user")
class ConcurrentAccountProvisioningTest {
    @Test
    void simultaneousFirstVisitsReturnOneGameAccount() throws Exception {
        var ready = new CountDownLatch(12);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var results = new ArrayList<Future<String>>();
            for (int request = 0; request < 12; request++) {
                results.add(executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(5, TimeUnit.SECONDS));
                    return given().get("/api/v1/account")
                            .then().statusCode(200)
                            .body("id", notNullValue())
                            .body("keycloakSubject", equalTo("concurrent-first-lab-login"))
                            .extract().path("id");
                }));
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            var ids = new HashSet<String>();
            for (var result : results) {
                ids.add(result.get(20, TimeUnit.SECONDS));
            }
            assertEquals(1, ids.size());
        }
    }
}
