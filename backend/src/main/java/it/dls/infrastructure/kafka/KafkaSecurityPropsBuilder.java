package it.dls.infrastructure.kafka;

import it.dls.domain.cluster.KafkaSecurityConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.config.SaslConfigs;
import org.apache.kafka.common.config.SslConfigs;

import java.util.Properties;

final class KafkaSecurityPropsBuilder {

    private KafkaSecurityPropsBuilder() {}

    static Properties base(String bootstrapServers, KafkaSecurityConfig security) {
        var props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        switch (security.protocol()) {
            case PLAINTEXT -> props.put("security.protocol", "PLAINTEXT");
            case SSL -> {
                props.put("security.protocol", "SSL");
                props.put(SslConfigs.SSL_KEYSTORE_TYPE_CONFIG, "PEM");
                props.put(SslConfigs.SSL_KEYSTORE_CERTIFICATE_CHAIN_CONFIG,
                    security.encryptedKeystorePem());
                applyTruststore(props, security.encryptedTruststorePem());
            }
            case SASL_PLAIN -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "PLAIN");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.plain.PlainLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
                if (security.tlsEnabled()) applyTruststore(props, security.encryptedTruststorePem());
            }
            case SASL_SCRAM_SHA_256 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-256");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
                if (security.tlsEnabled()) applyTruststore(props, security.encryptedTruststorePem());
            }
            case SASL_SCRAM_SHA_512 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-512");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
                if (security.tlsEnabled()) applyTruststore(props, security.encryptedTruststorePem());
            }
        }
        return props;
    }

    // Null truststorePem = rely on JVM default cacerts (public CA brokers).
    private static void applyTruststore(Properties props, String truststorePem) {
        if (truststorePem == null || truststorePem.isBlank()) return;
        props.put(SslConfigs.SSL_TRUSTSTORE_TYPE_CONFIG, "PEM");
        props.put(SslConfigs.SSL_TRUSTSTORE_CERTIFICATES_CONFIG, truststorePem);
    }

    static String buildJaas(String loginModule, String username, String password) {
        return loginModule + " required username=\"" + username + "\" password=\"" + password + "\";";
    }
}
