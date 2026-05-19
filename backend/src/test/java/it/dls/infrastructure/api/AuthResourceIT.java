package it.dls.infrastructure.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthResourceIT {

    private static final String EMAIL = "authtest@dls.io";
    private static final String PASSWORD = "S3cur3Pass!";
    private static final String DISPLAY_NAME = "Auth Test";

    @Inject
    EntityManager em;

    @Test
    @Order(1)
    void setupRequired_returnsTrueWhenNoAdmin() {
        given()
            .when().get("/api/setup/status")
            .then()
            .statusCode(200)
            .body("setupRequired", is(true));
    }

    @Test
    @Order(2)
    void createAdminAndLogin_returnsJwt() {
        // Create admin
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","displayName":"%s","password":"%s"}
                """.formatted(EMAIL, DISPLAY_NAME, PASSWORD))
            .when().post("/api/setup")
            .then()
            .statusCode(201);

        // Login
        String token = given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(EMAIL, PASSWORD))
            .when().post("/api/auth/login")
            .then()
            .statusCode(200)
            .body("token", notNullValue())
            .extract().path("token");

        // /me with JWT
        given()
            .header("Authorization", "Bearer " + token)
            .when().get("/api/auth/me")
            .then()
            .statusCode(200)
            .body("email", equalTo(EMAIL))
            .body("role", equalTo("ADMIN"));
    }

    @Test
    @Order(3)
    void wrongPassword_returns401() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"wrong"}
                """.formatted(EMAIL))
            .when().post("/api/auth/login")
            .then()
            .statusCode(401);
    }

    @Test
    @Order(99)
    @Transactional
    void cleanup() {
        UserEntity.delete("email", EMAIL);
    }
}
