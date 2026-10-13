package it.dls.infrastructure.metrics;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import it.dls.domain.cluster.KafkaCluster;
import it.dls.domain.cluster.KafkaClusterRepository;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.dlqconfig.DlqConfig;
import it.dls.domain.dlqconfig.DlqConfigRepository;
import it.dls.domain.dlqconfig.FetchConfig;
import it.dls.domain.dlqconfig.RetentionPolicy;
import it.dls.domain.message.DlqMessage;
import it.dls.domain.message.MessageRepository;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;

@QuarkusTest
class MetricsEndpointIT {

    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject DlqMessageMetrics metrics;

    @Test
    @TestTransaction
    void metricsEndpoint_exposesStatusGaugeForDlqConfig() {
        var clusterName = "metrics-cluster-" + UUID.randomUUID();
        var cluster = KafkaCluster.create("localhost:9092", clusterName, KafkaSecurityConfig.plaintext(), null);
        clusterRepo.save(cluster);
        var topic = "metrics-" + UUID.randomUUID() + ".dlq";
        var config = DlqConfig.create(cluster.getId(), topic, "Metrics DLQ",
            FetchConfig.onDemand(100), RetentionPolicy.maxDays(7), null);
        configRepo.save(config);
        messageRepo.save(DlqMessage.ingest(config.getId(), 0, 0L, Instant.now(),
            null, new byte[]{1}, null, null, Map.of(), false));
        messageRepo.save(DlqMessage.ingest(config.getId(), 0, 1L, Instant.now(),
            null, new byte[]{1}, null, null, Map.of(), false));

        metrics.refresh();

        var labels = "cluster=\"" + clusterName + "\",dlq_config=\"Metrics DLQ\",status=\"%s\",topic=\"" + topic + "\"";
        given().when().get("/q/metrics")
            .then().statusCode(200)
            .body(containsString("dls_dlq_messages{" + labels.formatted("NEW") + "} 2.0"))
            .body(containsString("dls_dlq_messages{" + labels.formatted("REPLAYED") + "} 0.0"));
    }
}
