package it.dls.infrastructure.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import it.dls.infrastructure.persistence.KafkaClusterEntity;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ClusterResourceIT {

    private static final String ADMIN_EMAIL = "cluster-it@dls.io";
    private static final String ADMIN_PASS = "Secure123!";

    @Inject
    EntityManager em;

    @BeforeEach
    @Transactional
    void ensureClean() {
        em.createQuery("DELETE FROM KafkaClusterEntity").executeUpdate();
        UserEntity.delete("email", ADMIN_EMAIL);
    }

    private String obtainAdminToken() {
        given().contentType(ContentType.JSON)
            .body("""
                {"email":"%s","displayName":"IT User","password":"%s"}
                """.formatted(ADMIN_EMAIL, ADMIN_PASS))
            .post("/api/setup");
        return given().contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(ADMIN_EMAIL, ADMIN_PASS))
            .post("/api/auth/login")
            .then().extract().path("token");
    }

    @Test
    @Order(1)
    void listClusters_emptyWhenNone() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .get("/api/clusters")
            .then()
            .statusCode(200)
            .body("", hasSize(0));
    }

    @Test
    @Order(2)
    void createCluster_kafkaUnreachable_returns422() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "name": "Test Cluster",
                  "bootstrapServers": "unreachable-host:9092",
                  "securityProtocol": "PLAINTEXT"
                }
                """)
            .post("/api/clusters")
            .then()
            .statusCode(422)
            .body("code", is("CONNECTIVITY_ERROR"))
            .body("message", containsString("Kafka"));
    }

    @Test
    @Order(3)
    void createCluster_missingName_returns400() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "bootstrapServers": "localhost:9092",
                  "securityProtocol": "PLAINTEXT"
                }
                """)
            .post("/api/clusters")
            .then()
            .statusCode(400)
            .body("code", is("INVALID_REQUEST"));
    }

    @Test
    @Order(4)
    void deleteCluster_notFound_returns404() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .delete("/api/clusters/00000000-0000-0000-0000-000000000099")
            .then()
            .statusCode(404);
    }

    @Test
    @Order(5)
    void listClusters_unauthenticated_returns401() {
        given()
            .get("/api/clusters")
            .then()
            .statusCode(401);
    }

    @Test
    @Order(6)
    void createDlqConfig_clusterNotFound_returns400() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "topicName": "my-service.dlq",
                  "displayName": "My Service DLQ",
                  "downloadMode": "ON_DEMAND",
                  "batchSize": 100,
                  "retentionType": "MAX_AGE_DAYS",
                  "retentionValue": 30
                }
                """)
            .post("/api/clusters/00000000-0000-0000-0000-000000000099/dlq-configs")
            .then()
            .statusCode(400);
    }
}
