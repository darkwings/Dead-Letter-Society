package it.dls.infrastructure.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;

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

    @BeforeEach
    @Transactional
    void ensureClean() {
        UserEntity.delete("email", EMAIL);
    }

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

    // ── Password-change & admin-reset integration tests ──────────────────────

    private static final String ADMIN_EMAIL   = "itadmin@dls.io";
    private static final String REGULAR_EMAIL = "ituser@dls.io";
    private static final String IT_PASSWORD   = "TestPass123!";

    @BeforeEach
    @Transactional
    void cleanItUsers() {
        UserEntity.delete("email in ?1", List.of(ADMIN_EMAIL, REGULAR_EMAIL));
    }

    /** Creates the IT admin via the setup endpoint and returns a JWT. */
    private String createAdminAndLogin() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","displayName":"IT Admin","password":"%s"}
                """.formatted(ADMIN_EMAIL, IT_PASSWORD))
            .when().post("/api/setup")
            .then()
            .statusCode(anyOf(is(201), is(409)));

        return given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(ADMIN_EMAIL, IT_PASSWORD))
            .when().post("/api/auth/login")
            .then()
            .statusCode(200)
            .body("token", notNullValue())
            .extract().path("token");
    }

    @Test
    @Order(10)
    void changeSelf_correctCurrentPassword_returns204() {
        String token = createAdminAndLogin();

        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {"currentPassword":"%s","newPassword":"NewPass456!"}
                """.formatted(IT_PASSWORD))
            .when().patch("/api/auth/users/me/password")
            .then()
            .statusCode(204);
    }

    @Test
    @Order(11)
    void changeSelf_wrongCurrentPassword_returns401() {
        String token = createAdminAndLogin();

        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {"currentPassword":"wrongpassword","newPassword":"NewPass456!"}
                """)
            .when().patch("/api/auth/users/me/password")
            .then()
            .statusCode(401);
    }

    @Test
    @Order(12)
    void adminReset_asAdmin_returns204() {
        String adminToken = createAdminAndLogin();

        given()
            .header("Authorization", "Bearer " + adminToken)
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","displayName":"IT User","password":"%s"}
                """.formatted(REGULAR_EMAIL, IT_PASSWORD))
            .when().post("/api/auth/users")
            .then()
            .statusCode(201);

        String userId = given()
            .header("Authorization", "Bearer " + adminToken)
            .when().get("/api/auth/users")
            .then()
            .statusCode(200)
            .extract()
            .jsonPath()
            .getString("find { it.email == '%s' }.id".formatted(REGULAR_EMAIL));

        given()
            .header("Authorization", "Bearer " + adminToken)
            .contentType(ContentType.JSON)
            .body("""
                {"newPassword":"ResetPass789!"}
                """)
            .when().patch("/api/auth/users/" + userId + "/password")
            .then()
            .statusCode(204);
    }

    @Test
    @Order(13)
    void adminReset_asNonAdmin_returns403() {
        String adminToken = createAdminAndLogin();

        given()
            .header("Authorization", "Bearer " + adminToken)
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","displayName":"IT User","password":"%s"}
                """.formatted(REGULAR_EMAIL, IT_PASSWORD))
            .when().post("/api/auth/users")
            .then()
            .statusCode(anyOf(is(201), is(409)));

        String userToken = given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(REGULAR_EMAIL, IT_PASSWORD))
            .when().post("/api/auth/login")
            .then()
            .statusCode(200)
            .extract().path("token");

        String adminId = given()
            .header("Authorization", "Bearer " + adminToken)
            .when().get("/api/auth/users")
            .then().extract()
            .jsonPath()
            .getString("find { it.email == '%s' }.id".formatted(ADMIN_EMAIL));

        given()
            .header("Authorization", "Bearer " + userToken)
            .contentType(ContentType.JSON)
            .body("""
                {"newPassword":"Hacked!123"}
                """)
            .when().patch("/api/auth/users/" + adminId + "/password")
            .then()
            .statusCode(403);
    }
}
