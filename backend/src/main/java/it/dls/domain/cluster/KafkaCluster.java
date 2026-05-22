package it.dls.domain.cluster;

import java.util.UUID;

public class KafkaCluster {

    private UUID id;
    private String name;
    private String bootstrapServers;
    private KafkaSecurityConfig securityConfig;
    private SchemaRegistryConfig schemaRegistry;  // nullable

    private KafkaCluster() {}

    public static KafkaCluster create(String bootstrapServers, String name,
                                      KafkaSecurityConfig securityConfig,
                                      SchemaRegistryConfig schemaRegistry) {
        if (bootstrapServers == null || bootstrapServers.isBlank())
            throw new IllegalArgumentException("bootstrapServers must not be blank");
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("name must not be blank");
        if (securityConfig == null)
            throw new IllegalArgumentException("securityConfig must not be null");
        var c = new KafkaCluster();
        c.id = UUID.randomUUID();
        c.name = name;
        c.bootstrapServers = bootstrapServers;
        c.securityConfig = securityConfig;
        c.schemaRegistry = schemaRegistry;
        return c;
    }

    public static KafkaCluster reconstitute(UUID id, String name, String bootstrapServers,
                                            KafkaSecurityConfig securityConfig,
                                            SchemaRegistryConfig schemaRegistry) {
        var c = new KafkaCluster();
        c.id = id;
        c.name = name;
        c.bootstrapServers = bootstrapServers;
        c.securityConfig = securityConfig;
        c.schemaRegistry = schemaRegistry;
        return c;
    }

    public void updateName(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("name must not be blank");
        this.name = name;
    }

    public void updateBootstrapServers(String bootstrapServers) {
        if (bootstrapServers == null || bootstrapServers.isBlank())
            throw new IllegalArgumentException("bootstrapServers must not be blank");
        this.bootstrapServers = bootstrapServers;
    }

    public void updateSecurityConfig(KafkaSecurityConfig securityConfig) {
        if (securityConfig == null) throw new IllegalArgumentException("securityConfig must not be null");
        this.securityConfig = securityConfig;
    }

    public void updateSchemaRegistry(SchemaRegistryConfig schemaRegistry) {
        this.schemaRegistry = schemaRegistry;  // null = remove SR config
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getBootstrapServers() { return bootstrapServers; }
    public KafkaSecurityConfig getSecurityConfig() { return securityConfig; }
    public SchemaRegistryConfig getSchemaRegistry() { return schemaRegistry; }
}
