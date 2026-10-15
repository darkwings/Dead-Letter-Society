package it.dls.infrastructure.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import it.dls.application.identity.PasswordHashPort;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.*;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import it.dls.infrastructure.persistence.UserEntity;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class MessageFailureInfoIT {

    private static final String ADMIN_EMAIL = "failure-it@dls.io";
    private static final String ADMIN_PASS = "Secure123!";

    @Inject EntityManager em;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject MessageRepository messageRepo;
    @Inject UserRepository userRepo;
    @Inject PasswordHashPort passwordHash;

    UUID configId;
    UUID messageId;
    UUID bareMessageId;

    @BeforeEach
    @Transactional
    void setUp() {
        em.createQuery("DELETE FROM KafkaClusterEntity").executeUpdate();
        UserEntity.delete("email", ADMIN_EMAIL);
        var admin = User.createLocal(ADMIN_EMAIL, "IT User", passwordHash.hash(ADMIN_PASS));
        admin.promoteToAdmin();
        userRepo.save(admin);

        var cluster = KafkaCluster.create("localhost:9092", "fi-cluster-" + UUID.randomUUID(),
            KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(cluster);
        var config = DlqConfig.create(cluster.getId(), "orders.dlq", "Orders",
            FetchConfig.onDemand(10), RetentionPolicy.maxCount(10), null);
        config.changeHeaderMapping(HeaderPreset.SPRING, null);
        configRepo.save(config);
        configId = config.getId();

        var msg = DlqMessage.ingest(configId, 0, 5L, Instant.now(), null, new byte[]{1}, null, null,
            Map.of("kafka_dlt-original-topic", "orders",
                   "kafka_dlt-original-partition", "3",
                   "kafka_dlt-exception-message", "boom"), false);
        messageRepo.save(msg);
        messageId = msg.getId();

        var bare = DlqMessage.ingest(configId, 0, 6L, Instant.now(), null, new byte[]{1}, null, null,
            Map.of(), false);
        messageRepo.save(bare);
        bareMessageId = bare.getId();
    }

    private String token() {
        return given().contentType(ContentType.JSON)
            .body("""
                {"email":"%s","password":"%s"}
                """.formatted(ADMIN_EMAIL, ADMIN_PASS))
            .post("/api/auth/login")
            .then().extract().path("token");
    }

    @Test
    void getMessageReturnsFailureInfoFromConfigMapping() {
        given().header("Authorization", "Bearer " + token()).get("/api/messages/" + messageId)
            .then().statusCode(200)
            .body("failureInfo.originalTopic", equalTo("orders"))
            .body("failureInfo.originalPartition", equalTo(3))
            .body("failureInfo.exceptionMessage", equalTo("boom"))
            .body("failureInfo.originalOffset", nullValue())
            .body("headers.'kafka_dlt-original-topic'", equalTo("orders"));
    }

    @Test
    void messageWithoutHeadersReturnsAllNullFailureInfo() {
        given().header("Authorization", "Bearer " + token()).get("/api/messages/" + bareMessageId)
            .then().statusCode(200)
            .body("failureInfo", notNullValue())
            .body("failureInfo.originalTopic", nullValue())
            .body("failureInfo.exceptionMessage", nullValue());
    }

    @Test
    void perConfigListIncludesFailureInfoPerMessage() {
        given().header("Authorization", "Bearer " + token())
            .get("/api/dlq-configs/" + configId + "/messages")
            .then().statusCode(200)
            .body("messages.find { it.id == '" + messageId + "' }.failureInfo.originalTopic", equalTo("orders"));
    }

    @Test
    void allMessagesListIncludesFailureInfo() {
        given().header("Authorization", "Bearer " + token())
            .get("/api/messages")
            .then().statusCode(200)
            .body("messages.find { it.id == '" + messageId + "' }.failureInfo.originalTopic", equalTo("orders"));
    }
}
