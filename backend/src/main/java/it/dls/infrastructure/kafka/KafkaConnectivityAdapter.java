package it.dls.infrastructure.kafka;

import it.dls.application.cluster.ConnectivityResult;
import it.dls.application.cluster.ConnectivityValidationPort;
import it.dls.domain.cluster.KafkaSecurityConfig;
import it.dls.domain.cluster.KafkaSecurityProtocol;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.common.config.SaslConfigs;
import org.apache.kafka.common.config.SslConfigs;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class KafkaConnectivityAdapter implements ConnectivityValidationPort {

    @Override
    public ConnectivityResult testKafka(String bootstrapServers, KafkaSecurityConfig security) {
        var props = buildKafkaProperties(bootstrapServers, security);
        props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000");
        props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000");
        try (var admin = AdminClient.create(props)) {
            admin.listTopics().names().get(5, TimeUnit.SECONDS);
            return ConnectivityResult.ok();
        } catch (Exception e) {
            return ConnectivityResult.fail(e.getMessage());
        }
    }

    @Override
    public ConnectivityResult testSchemaRegistry(String url, SchemaRegistryAuthConfig auth) {
        try {
            var conn = (HttpURLConnection) URI.create(url + "/subjects").toURL().openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("GET");
            if (auth.hasCredentials()) {
                String creds = auth.encryptedUsername() + ":" + auth.encryptedPassword();
                String encoded = Base64.getEncoder()
                    .encodeToString(creds.getBytes(StandardCharsets.UTF_8));
                conn.setRequestProperty("Authorization", "Basic " + encoded);
            }
            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) return ConnectivityResult.ok();
            return ConnectivityResult.fail("HTTP " + status);
        } catch (Exception e) {
            return ConnectivityResult.fail(e.getMessage());
        }
    }

    @Override
    public List<String> listTopics(String bootstrapServers, KafkaSecurityConfig security) {
        var props = buildKafkaProperties(bootstrapServers, security);
        props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000");
        props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000");
        try (var admin = AdminClient.create(props)) {
            var names = admin.listTopics().names().get(5, TimeUnit.SECONDS);
            return names.stream().filter(n -> !n.startsWith("_")).sorted().toList();
        } catch (Exception e) {
            throw new RuntimeException("Failed to list topics: " + e.getMessage(), e);
        }
    }

    private Properties buildKafkaProperties(String bootstrapServers, KafkaSecurityConfig security) {
        var props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        switch (security.protocol()) {
            case PLAINTEXT -> props.put("security.protocol", "PLAINTEXT");
            case SSL -> {
                props.put("security.protocol", "SSL");
                props.put(SslConfigs.SSL_KEYSTORE_TYPE_CONFIG, "PEM");
                props.put(SslConfigs.SSL_KEYSTORE_CERTIFICATE_CHAIN_CONFIG,
                    security.encryptedKeystorePem());
            }
            case SASL_PLAIN -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "PLAIN");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaasConfig(
                    "org.apache.kafka.common.security.plain.PlainLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_256 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-256");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaasConfig(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_512 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-512");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaasConfig(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
        }
        return props;
    }

    private String buildJaasConfig(String loginModule, String username, String password) {
        return loginModule + " required username=\"" + username + "\" password=\"" + password + "\";";
    }
}
