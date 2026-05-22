package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.cluster.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "kafka_clusters")
public class KafkaClusterEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    public String name;

    @Column(name = "bootstrap_servers")
    public String bootstrapServers;

    @Enumerated(EnumType.STRING)
    @Column(name = "security_protocol")
    public KafkaSecurityProtocol securityProtocol;

    @Column(name = "encrypted_username")
    public String encryptedUsername;

    @Column(name = "encrypted_password")
    public String encryptedPassword;

    @Column(name = "encrypted_keystore")
    public String encryptedKeystore;

    @Column(name = "sr_url")
    public String srUrl;

    @Column(name = "sr_encrypted_user")
    public String srEncryptedUser;

    @Column(name = "sr_encrypted_pass")
    public String srEncryptedPass;

    @Column(name = "created_at")
    public Instant createdAt;

    @Column(name = "updated_at")
    public Instant updatedAt;

    public static KafkaClusterEntity fromDomain(KafkaCluster c) {
        var e = new KafkaClusterEntity();
        e.id = c.getId();
        e.name = c.getName();
        e.bootstrapServers = c.getBootstrapServers();
        e.securityProtocol = c.getSecurityConfig().protocol();
        e.encryptedUsername = c.getSecurityConfig().encryptedUsername();
        e.encryptedPassword = c.getSecurityConfig().encryptedPassword();
        e.encryptedKeystore = c.getSecurityConfig().encryptedKeystorePem();
        if (c.getSchemaRegistry() != null) {
            e.srUrl = c.getSchemaRegistry().url();
            e.srEncryptedUser = c.getSchemaRegistry().encryptedUsername();
            e.srEncryptedPass = c.getSchemaRegistry().encryptedPassword();
        }
        e.createdAt = Instant.now();
        e.updatedAt = Instant.now();
        return e;
    }

    public KafkaCluster toDomain() {
        var security = new KafkaSecurityConfig(securityProtocol,
            encryptedUsername, encryptedPassword, encryptedKeystore);
        SchemaRegistryConfig sr = srUrl != null
            ? new SchemaRegistryConfig(srUrl, srEncryptedUser, srEncryptedPass)
            : null;
        return KafkaCluster.reconstitute(id, name, bootstrapServers, security, sr);
    }
}
