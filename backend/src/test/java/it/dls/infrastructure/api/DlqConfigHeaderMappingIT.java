package it.dls.infrastructure.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import it.dls.application.identity.PasswordHashPort;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class DlqConfigHeaderMappingIT {

    private static final String ADMIN_EMAIL = "header-it@dls.io";
    private static final String ADMIN_PASS = "Secure123!";

    @Inject EntityManager em;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject UserRepository userRepo;
    @Inject PasswordHashPort passwordHash;

    @BeforeEach
    @Transactional
    void clean() {
        em.createQuery("DELETE FROM KafkaClusterEntity").executeUpdate();
        UserEntity.delete("email", ADMIN_EMAIL);
        // Created directly: POST /api/setup only works while no user exists, which other ITs break.
        var admin = User.createLocal(ADMIN_EMAIL, "IT User", passwordHash.hash(ADMIN_PASS));
        admin.promoteToAdmin();
        userRepo.save(admin);
    }

    private String obtainAdminToken() {
        return given().contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(ADMIN_EMAIL, ADMIN_PASS))
            .post("/api/auth/login")
            .then().extract().path("token");
    }

    private String createCluster() {
        var c = KafkaCluster.create("localhost:9092", "hdr-cluster-" + UUID.randomUUID(),
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(c);
        return c.getId().toString();
    }

    private static final String BASE_BODY = """
        {"topicName":"orders.dlq","displayName":"Orders","downloadMode":"ON_DEMAND",
         "batchSize":100,"retentionType":"MAX_COUNT","retentionValue":100%s}""";

    private io.restassured.response.ValidatableResponse create(String token, String clusterId, String extra) {
        return given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
            .body(BASE_BODY.formatted(extra))
            .post("/api/clusters/" + clusterId + "/dlq-configs")
            .then();
    }

    @Test
    void createWithSpringPresetReturnsSpringMapping() {
        var token = obtainAdminToken();
        create(token, createCluster(), ",\"headerPreset\":\"SPRING\"")
            .statusCode(201)
            .body("headerPreset", equalTo("SPRING"))
            .body("headerMapping.originalTopic.name", equalTo("kafka_dlt-original-topic"))
            .body("headerMapping.originalPartition.encoding", equalTo("INT32"));
    }

    @Test
    void createWithoutPresetReturnsLegacy() {
        var token = obtainAdminToken();
        create(token, createCluster(), "")
            .statusCode(201)
            .body("headerPreset", equalTo("LEGACY"))
            .body("headerMapping.originalTopic.name", equalTo("x-original-topic"));
    }

    @Test
    void customMappingWithBlankNameIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(),
            ",\"headerPreset\":\"CUSTOM\",\"headerMapping\":{\"originalTopic\":{\"name\":\" \",\"encoding\":\"STRING\"}}")
            .statusCode(400);
    }

    @Test
    void customMappingWithDisallowedEncodingIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(),
            ",\"headerPreset\":\"CUSTOM\",\"headerMapping\":{\"originalTopic\":{\"name\":\"t\",\"encoding\":\"INT32\"}}")
            .statusCode(400);
    }

    @Test
    void customWithoutMappingIs400() {
        var token = obtainAdminToken();
        create(token, createCluster(), ",\"headerPreset\":\"CUSTOM\"")
            .statusCode(400);
    }

    @Test
    void updateSwitchesPresetAndPersists() {
        var token = obtainAdminToken();
        var clusterId = createCluster();
        String configId = create(token, clusterId, "").statusCode(201).extract().path("id");
        given().header("Authorization", "Bearer " + token).contentType(ContentType.JSON)
            .body("""
                {"displayName":"Orders","downloadMode":"ON_DEMAND","batchSize":100,
                 "retentionType":"MAX_COUNT","retentionValue":100,
                 "headerPreset":"QUARKUS_SMALLRYE"}""")
            .put("/api/clusters/" + clusterId + "/dlq-configs/" + configId)
            .then().statusCode(200);
        given().header("Authorization", "Bearer " + token)
            .get("/api/dlq-configs/" + configId)
            .then().statusCode(200)
            .body("headerPreset", equalTo("QUARKUS_SMALLRYE"))
            .body("headerMapping.originalTopic.name", equalTo("dead-letter-topic"));
    }

    @Test
    void presetsEndpointListsThreePresets() {
        var token = obtainAdminToken();
        given().header("Authorization", "Bearer " + token)
            .get("/api/header-presets")
            .then().statusCode(200)
            .body("preset", contains("LEGACY", "SPRING", "QUARKUS_SMALLRYE"))
            .body("find { it.preset == 'SPRING' }.mapping.originalOffset.encoding", equalTo("INT64"));
    }
}
