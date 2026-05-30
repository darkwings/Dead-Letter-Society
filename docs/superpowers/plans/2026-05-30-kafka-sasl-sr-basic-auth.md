# Kafka SASL/SCRAM + Schema Registry Basic Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs that prevent SASL/SCRAM and Schema Registry basic auth from working — hardcoded `SASL_SSL` transport and encrypted credentials being passed to connectivity tests — and expose `tlsEnabled` through all layers so non-TLS SASL clusters can connect.

**Architecture:** Add `boolean tlsEnabled` to `KafkaSecurityConfig` (domain record). Infrastructure adapters select `SASL_SSL` vs `SASL_PLAINTEXT` based on the flag. `ManageClusterUseCase.registerCluster` builds two configs: plaintext for the connectivity test, encrypted for persistence. All layers are updated top-to-bottom: domain → application → infrastructure → persistence → API.

**Tech Stack:** Quarkus 3.x, Hibernate ORM Panache, Flyway, Apache Kafka client, Confluent Schema Registry client, JUnit 5 + AssertJ + Mockito.

---

## File Map

| File | Action |
|------|--------|
| `backend/src/main/resources/db/migration/V7__add_tls_enabled.sql` | Create |
| `backend/src/main/java/it/dls/domain/cluster/KafkaSecurityConfig.java` | Modify |
| `backend/src/main/java/it/dls/application/cluster/RegisterClusterCommand.java` | Modify |
| `backend/src/main/java/it/dls/application/cluster/ManageClusterUseCase.java` | Modify |
| `backend/src/main/java/it/dls/infrastructure/kafka/KafkaSecurityPropsBuilder.java` | Modify |
| `backend/src/main/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapter.java` | Modify |
| `backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterEntity.java` | Modify |
| `backend/src/main/java/it/dls/infrastructure/api/cluster/CreateClusterRequest.java` | Modify |
| `backend/src/main/java/it/dls/infrastructure/api/cluster/ClusterResource.java` | Modify |
| `backend/src/test/java/it/dls/domain/cluster/KafkaClusterTest.java` | Modify |
| `backend/src/test/java/it/dls/application/cluster/ManageClusterUseCaseTest.java` | Modify |
| `backend/src/test/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapterIT.java` | Modify |

---

## Task 1: Flyway Migration V7

**Files:**
- Create: `backend/src/main/resources/db/migration/V7__add_tls_enabled.sql`

- [ ] **Step 1: Create migration file**

```sql
-- V7__add_tls_enabled.sql
-- Adds TLS toggle for SASL protocols.
-- Default TRUE: existing rows were registered assuming SASL_SSL.
ALTER TABLE kafka_clusters
    ADD COLUMN tls_enabled BOOLEAN NOT NULL DEFAULT TRUE;
```

- [ ] **Step 2: Verify migration runs**

```bash
cd backend
./gradlew quarkusDev
```

Watch startup log for: `Migrating schema "public" to version "7 - add tls enabled"`. No errors expected.

Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V7__add_tls_enabled.sql
git commit -m "feat(db): add tls_enabled column to kafka_clusters (V7)"
```

---

## Task 2: KafkaSecurityConfig + All Compilation Fixes

This task changes the `KafkaSecurityConfig` record signature from 4 fields to 5. It fixes every file that breaks as a result. The commit produces fully compilable, passing unit tests.

**Files:**
- Modify: `backend/src/main/java/it/dls/domain/cluster/KafkaSecurityConfig.java`
- Modify: `backend/src/main/java/it/dls/application/cluster/RegisterClusterCommand.java`
- Modify: `backend/src/main/java/it/dls/application/cluster/ManageClusterUseCase.java` (compile fix only — `decryptSecurity` + `buildSecurityConfig`)
- Modify: `backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterEntity.java` (compile fix)
- Modify: `backend/src/test/java/it/dls/domain/cluster/KafkaClusterTest.java`
- Modify: `backend/src/test/java/it/dls/application/cluster/ManageClusterUseCaseTest.java`

- [ ] **Step 1: Add a failing test for the new field**

In `KafkaClusterTest.java`, add this test at the end of the class (before the last `}`):

```java
@Test
void saslScram256Config_stores_tlsEnabled() {
    var config = KafkaSecurityConfig.saslScram256("enc-user", "enc-pass", false);
    assertThat(config.tlsEnabled()).isFalse();
    assertThat(config.protocol()).isEqualTo(KafkaSecurityProtocol.SASL_SCRAM_SHA_256);

    var configTls = KafkaSecurityConfig.saslScram256("enc-user", "enc-pass", true);
    assertThat(configTls.tlsEnabled()).isTrue();
}
```

- [ ] **Step 2: Run to confirm compile failure**

```bash
cd backend
./gradlew :test --tests "it.dls.domain.cluster.KafkaClusterTest" 2>&1 | grep -E "error|FAILED|cannot find"
```

Expected: compilation error — `saslScram256` method not found.

- [ ] **Step 3: Replace KafkaSecurityConfig.java**

```java
package it.dls.domain.cluster;

public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    boolean tlsEnabled,
    String encryptedUsername,
    String encryptedPassword,
    String encryptedKeystorePem
) {
    public KafkaSecurityConfig {
        if (protocol == null) throw new IllegalArgumentException("protocol must not be null");
        if (protocol == KafkaSecurityProtocol.SASL_PLAIN
                || protocol == KafkaSecurityProtocol.SASL_SCRAM_SHA_256
                || protocol == KafkaSecurityProtocol.SASL_SCRAM_SHA_512) {
            if (encryptedUsername == null || encryptedPassword == null)
                throw new IllegalArgumentException(
                    protocol + " requires encryptedUsername and encryptedPassword");
        }
        if (protocol == KafkaSecurityProtocol.SSL && encryptedKeystorePem == null)
            throw new IllegalArgumentException("SSL requires encryptedKeystorePem");
    }

    public static KafkaSecurityConfig plaintext() {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.PLAINTEXT, false, null, null, null);
    }

    public static KafkaSecurityConfig ssl(String encryptedKeystorePem) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SSL, true, null, null, encryptedKeystorePem);
    }

    public static KafkaSecurityConfig saslPlain(String encryptedUsername, String encryptedPassword,
                                                 boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }

    public static KafkaSecurityConfig saslScram256(String encryptedUsername, String encryptedPassword,
                                                    boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_SCRAM_SHA_256,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }

    public static KafkaSecurityConfig saslScram512(String encryptedUsername, String encryptedPassword,
                                                    boolean tlsEnabled) {
        return new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_SCRAM_SHA_512,
            tlsEnabled, encryptedUsername, encryptedPassword, null);
    }
}
```

- [ ] **Step 4: Fix KafkaClusterTest — two broken call sites**

In `KafkaClusterTest.java`:

**Line 102** — `saslPlain` now requires a third `tlsEnabled` arg:
```java
// BEFORE
var sasl = KafkaSecurityConfig.saslPlain("enc-user", "enc-pass");
// AFTER
var sasl = KafkaSecurityConfig.saslPlain("enc-user", "enc-pass", true);
```

**Line 118** — raw 4-arg constructor now needs 5 args:
```java
// BEFORE
new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN, null, null, null)
// AFTER
new KafkaSecurityConfig(KafkaSecurityProtocol.SASL_PLAIN, false, null, null, null)
```

- [ ] **Step 5: Replace RegisterClusterCommand.java**

```java
package it.dls.application.cluster;

import it.dls.domain.cluster.KafkaSecurityProtocol;

public record RegisterClusterCommand(
    String name,
    String bootstrapServers,
    KafkaSecurityProtocol securityProtocol,
    boolean tlsEnabled,
    String username,         // null unless SASL
    String password,         // null unless SASL
    String keystorePem,      // null unless SSL
    String srUrl,
    String srUsername,       // null if no SR auth
    String srPassword        // null if no SR auth
) {}
```

- [ ] **Step 6: Fix ManageClusterUseCase — compile-only fixes**

Update `decryptSecurity` to pass `tlsEnabled` through, and `buildSecurityConfig` to thread the new field:

```java
private KafkaSecurityConfig decryptSecurity(KafkaSecurityConfig enc) {
    return new KafkaSecurityConfig(
        enc.protocol(),
        enc.tlsEnabled(),
        enc.encryptedUsername() != null ? encryption.decrypt(enc.encryptedUsername()) : null,
        enc.encryptedPassword() != null ? encryption.decrypt(enc.encryptedPassword()) : null,
        enc.encryptedKeystorePem() != null ? encryption.decrypt(enc.encryptedKeystorePem()) : null
    );
}

private KafkaSecurityConfig buildSecurityConfig(RegisterClusterCommand cmd) {
    return switch (cmd.securityProtocol()) {
        case PLAINTEXT -> KafkaSecurityConfig.plaintext();
        case SSL -> KafkaSecurityConfig.ssl(encryption.encrypt(cmd.keystorePem()));
        case SASL_PLAIN -> KafkaSecurityConfig.saslPlain(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
        case SASL_SCRAM_SHA_256 -> KafkaSecurityConfig.saslScram256(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
        case SASL_SCRAM_SHA_512 -> KafkaSecurityConfig.saslScram512(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
    };
}
```

- [ ] **Step 7: Fix KafkaClusterEntity — toDomain and fromDomain**

Add field:
```java
@Column(name = "tls_enabled")
public boolean tlsEnabled;
```

Update `fromDomain`:
```java
// existing lines...
e.encryptedUsername = c.getSecurityConfig().encryptedUsername();
e.encryptedPassword = c.getSecurityConfig().encryptedPassword();
e.encryptedKeystore = c.getSecurityConfig().encryptedKeystorePem();
e.tlsEnabled = c.getSecurityConfig().tlsEnabled();   // ADD THIS LINE
```

Update `toDomain`:
```java
public KafkaCluster toDomain() {
    var security = new KafkaSecurityConfig(securityProtocol, tlsEnabled,
        encryptedUsername, encryptedPassword, encryptedKeystore);
    SchemaRegistryConfig sr = srUrl != null
        ? new SchemaRegistryConfig(srUrl, srEncryptedUser, srEncryptedPass)
        : null;
    return KafkaCluster.reconstitute(id, name, bootstrapServers, security, sr);
}
```

- [ ] **Step 8: Fix ManageClusterUseCaseTest — RegisterClusterCommand construction sites**

`RegisterClusterCommand` now has `boolean tlsEnabled` as 4th arg (after `securityProtocol`). Update all 5 construction sites by inserting `true` in position 4:

```java
// registerClusterSavesAndReturns (line ~40)
var cmd = new RegisterClusterCommand("prod", "broker:9092",
    KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
    "http://sr:8081", null, null);

// registerClusterEncryptsSaslCredentials (line ~52)
var cmd = new RegisterClusterCommand("prod", "broker:9092",
    KafkaSecurityProtocol.SASL_PLAIN, true, "user", "pass", null,
    "http://sr:8081", null, null);

// registerClusterEncodesSrCredentials (line ~61)
var cmd = new RegisterClusterCommand("prod", "broker:9092",
    KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
    "http://sr:8081", "sr-user", "sr-pass");

// registerClusterThrowsWhenKafkaUnreachable (line ~72)
var cmd = new RegisterClusterCommand("prod", "broker:9092",
    KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
    "http://sr:8081", null, null);

// registerClusterThrowsWhenSchemaRegistryUnreachable (line ~83)
var cmd = new RegisterClusterCommand("prod", "broker:9092",
    KafkaSecurityProtocol.PLAINTEXT, true, null, null, null,
    "http://sr:8081", null, null);
```

- [ ] **Step 9: Run unit tests**

```bash
cd backend
./gradlew :test --tests "it.dls.domain.cluster.KafkaClusterTest" \
                --tests "it.dls.application.cluster.ManageClusterUseCaseTest"
```

Expected: BUILD SUCCESSFUL, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add \
  backend/src/main/java/it/dls/domain/cluster/KafkaSecurityConfig.java \
  backend/src/main/java/it/dls/application/cluster/RegisterClusterCommand.java \
  backend/src/main/java/it/dls/application/cluster/ManageClusterUseCase.java \
  backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterEntity.java \
  backend/src/test/java/it/dls/domain/cluster/KafkaClusterTest.java \
  backend/src/test/java/it/dls/application/cluster/ManageClusterUseCaseTest.java
git commit -m "feat(domain): add tlsEnabled to KafkaSecurityConfig + SASL factory methods"
```

---

## Task 3: Fix Encryption Bug in ManageClusterUseCase

The current `registerCluster` builds one encrypted config and passes it to both `testKafka` and `KafkaCluster.create`. The connectivity test receives AES-encrypted credentials — which will never authenticate. This task fixes that by building two configs.

**Files:**
- Modify: `backend/src/test/java/it/dls/application/cluster/ManageClusterUseCaseTest.java`
- Modify: `backend/src/main/java/it/dls/application/cluster/ManageClusterUseCase.java`

- [ ] **Step 1: Add failing tests that pin the correct behaviour**

Add these two tests to `ManageClusterUseCaseTest`. Also add `import org.mockito.ArgumentCaptor;` at the top.

```java
@Test
void registerCluster_connectivityTestReceivesPlaintextCredentials() {
    var cmd = new RegisterClusterCommand("prod", "broker:9092",
        KafkaSecurityProtocol.SASL_SCRAM_SHA_256, false, "user", "pass", null,
        null, null, null);
    useCase.registerCluster(cmd);

    var captor = ArgumentCaptor.forClass(KafkaSecurityConfig.class);
    verify(connectivity).testKafka(eq("broker:9092"), captor.capture());
    assertThat(captor.getValue().encryptedUsername()).isEqualTo("user");
    assertThat(captor.getValue().encryptedPassword()).isEqualTo("pass");
}

@Test
void registerCluster_persistsEncryptedCredentials() {
    var cmd = new RegisterClusterCommand("prod", "broker:9092",
        KafkaSecurityProtocol.SASL_SCRAM_SHA_256, false, "user", "pass", null,
        null, null, null);
    var cluster = useCase.registerCluster(cmd);

    assertThat(cluster.getSecurityConfig().encryptedUsername()).isEqualTo("enc-user");
    assertThat(cluster.getSecurityConfig().encryptedPassword()).isEqualTo("enc-pass");
}
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend
./gradlew :test --tests "it.dls.application.cluster.ManageClusterUseCaseTest.registerCluster_connectivityTestReceivesPlaintextCredentials"
```

Expected: FAILED — captor captures `"enc-user"` but test expects `"user"`.

- [ ] **Step 3: Refactor ManageClusterUseCase.registerCluster**

Replace the current `registerCluster` and private helpers with the following. The old `buildSecurityConfig` becomes two methods:

```java
@Transactional
public KafkaCluster registerCluster(RegisterClusterCommand cmd) {
    var plainSecurity = buildPlainSecurityConfig(cmd);
    var kafkaResult = connectivity.testKafka(cmd.bootstrapServers(), plainSecurity);
    if (!kafkaResult.success())
        throw new ConnectivityValidationException("Kafka: " + kafkaResult.errorMessage());

    var encSecurity = buildEncryptedSecurityConfig(cmd);

    SchemaRegistryConfig srConfig = null;
    if (cmd.srUrl() != null && !cmd.srUrl().isBlank()) {
        var plainSrAuth = new SchemaRegistryAuthConfig(cmd.srUsername(), cmd.srPassword());
        var srResult = connectivity.testSchemaRegistry(cmd.srUrl(), plainSrAuth);
        if (!srResult.success())
            throw new ConnectivityValidationException("Schema Registry: " + srResult.errorMessage());
        srConfig = new SchemaRegistryConfig(
            cmd.srUrl(),
            cmd.srUsername() != null ? encryption.encrypt(cmd.srUsername()) : null,
            cmd.srPassword() != null ? encryption.encrypt(cmd.srPassword()) : null);
    }

    var cluster = KafkaCluster.create(cmd.bootstrapServers(), cmd.name(), encSecurity, srConfig);
    clusterRepo.save(cluster);
    return cluster;
}
```

Replace `buildSecurityConfig` with these two methods (delete the old one):

```java
private KafkaSecurityConfig buildPlainSecurityConfig(RegisterClusterCommand cmd) {
    return switch (cmd.securityProtocol()) {
        case PLAINTEXT -> KafkaSecurityConfig.plaintext();
        case SSL -> KafkaSecurityConfig.ssl(cmd.keystorePem());
        case SASL_PLAIN -> KafkaSecurityConfig.saslPlain(
            cmd.username(), cmd.password(), cmd.tlsEnabled());
        case SASL_SCRAM_SHA_256 -> KafkaSecurityConfig.saslScram256(
            cmd.username(), cmd.password(), cmd.tlsEnabled());
        case SASL_SCRAM_SHA_512 -> KafkaSecurityConfig.saslScram512(
            cmd.username(), cmd.password(), cmd.tlsEnabled());
    };
}

private KafkaSecurityConfig buildEncryptedSecurityConfig(RegisterClusterCommand cmd) {
    return switch (cmd.securityProtocol()) {
        case PLAINTEXT -> KafkaSecurityConfig.plaintext();
        case SSL -> KafkaSecurityConfig.ssl(encryption.encrypt(cmd.keystorePem()));
        case SASL_PLAIN -> KafkaSecurityConfig.saslPlain(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
        case SASL_SCRAM_SHA_256 -> KafkaSecurityConfig.saslScram256(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
        case SASL_SCRAM_SHA_512 -> KafkaSecurityConfig.saslScram512(
            encryption.encrypt(cmd.username()),
            encryption.encrypt(cmd.password()),
            cmd.tlsEnabled());
    };
}
```

- [ ] **Step 4: Run all use-case tests**

```bash
cd backend
./gradlew :test --tests "it.dls.application.cluster.ManageClusterUseCaseTest"
```

Expected: BUILD SUCCESSFUL, all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add \
  backend/src/main/java/it/dls/application/cluster/ManageClusterUseCase.java \
  backend/src/test/java/it/dls/application/cluster/ManageClusterUseCaseTest.java
git commit -m "fix(app): connectivity test uses plaintext credentials, storage uses encrypted"
```

---

## Task 4: SASL_PLAINTEXT Support in Kafka Props Builders

Both `KafkaSecurityPropsBuilder` and `KafkaConnectivityAdapter` duplicate the security props logic. Both need the same fix: SASL variants switch on `tlsEnabled()` to choose `SASL_SSL` vs `SASL_PLAINTEXT`.

**Files:**
- Modify: `backend/src/main/java/it/dls/infrastructure/kafka/KafkaSecurityPropsBuilder.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapter.java`

- [ ] **Step 1: Replace KafkaSecurityPropsBuilder.java**

```java
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
            }
            case SASL_PLAIN -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "PLAIN");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.plain.PlainLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_256 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-256");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
            case SASL_SCRAM_SHA_512 -> {
                props.put("security.protocol",
                    security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
                props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-512");
                props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
                    "org.apache.kafka.common.security.scram.ScramLoginModule",
                    security.encryptedUsername(), security.encryptedPassword()));
            }
        }
        return props;
    }

    static String buildJaas(String loginModule, String username, String password) {
        return loginModule + " required username=\"" + username + "\" password=\"" + password + "\";";
    }
}
```

- [ ] **Step 2: Update KafkaConnectivityAdapter.buildKafkaProperties**

Replace the `buildKafkaProperties` private method only (leave rest of the class unchanged):

```java
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
```

- [ ] **Step 3: Run existing IT tests to confirm nothing broken**

These run against the Quarkus dev services (in-memory Redpanda in `PLAINTEXT` mode), so they should still pass unchanged.

```bash
cd backend
./gradlew :test --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT"
```

Expected: BUILD SUCCESSFUL, 2 tests pass (`testKafkaConnectionWithDevServices`, `testUnreachableKafkaReturnsFailure`).

- [ ] **Step 4: Commit**

```bash
git add \
  backend/src/main/java/it/dls/infrastructure/kafka/KafkaSecurityPropsBuilder.java \
  backend/src/main/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapter.java
git commit -m "fix(infra): use SASL_PLAINTEXT when tlsEnabled=false in Kafka props builders"
```

---

## Task 5: Persistence + API Layer

Thread `tlsEnabled` through `KafkaClusterEntity`, `CreateClusterRequest`, and `ClusterResource`.

**Files:**
- Modify: `backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterEntity.java` (already done in Task 2 — verify, no-op if correct)
- Modify: `backend/src/main/java/it/dls/infrastructure/api/cluster/CreateClusterRequest.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/api/cluster/ClusterResource.java`

- [ ] **Step 1: Verify KafkaClusterEntity is already updated**

Check that `KafkaClusterEntity.java` has:
1. `public boolean tlsEnabled;` field with `@Column(name = "tls_enabled")`
2. `e.tlsEnabled = c.getSecurityConfig().tlsEnabled();` in `fromDomain`
3. `new KafkaSecurityConfig(securityProtocol, tlsEnabled, ...)` in `toDomain`

These were added in Task 2, Step 7. If missing, apply them now (see Task 2 Step 7 for the exact changes).

- [ ] **Step 2: Replace CreateClusterRequest.java**

```java
package it.dls.infrastructure.api.cluster;

import it.dls.domain.cluster.KafkaSecurityProtocol;

public record CreateClusterRequest(
    String name,
    String bootstrapServers,
    KafkaSecurityProtocol securityProtocol,
    Boolean tlsEnabled,     // nullable — null means caller wants default (true)
    String username,
    String password,
    String keystorePem,
    String srUrl,
    String srUsername,
    String srPassword
) {}
```

- [ ] **Step 3: Update ClusterResource.create — pass tlsEnabled to command**

In `ClusterResource.java`, replace the `RegisterClusterCommand` construction inside the `create` method:

```java
// BEFORE
var cmd = new RegisterClusterCommand(
    req.name(), req.bootstrapServers(), req.securityProtocol(),
    req.username(), req.password(), req.keystorePem(),
    req.srUrl(), req.srUsername(), req.srPassword()
);

// AFTER
var cmd = new RegisterClusterCommand(
    req.name(), req.bootstrapServers(), req.securityProtocol(),
    req.tlsEnabled() != null ? req.tlsEnabled() : true,
    req.username(), req.password(), req.keystorePem(),
    req.srUrl(), req.srUsername(), req.srPassword()
);
```

- [ ] **Step 4: Run ClusterResourceIT**

```bash
cd backend
./gradlew :test --tests "it.dls.infrastructure.api.ClusterResourceIT"
```

Expected: BUILD SUCCESSFUL, all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add \
  backend/src/main/java/it/dls/infrastructure/api/cluster/CreateClusterRequest.java \
  backend/src/main/java/it/dls/infrastructure/api/cluster/ClusterResource.java
git commit -m "feat(api): expose tlsEnabled in CreateClusterRequest, default true"
```

---

## Task 6: SASL/SCRAM + SR Basic Auth IT Tests

Add gated integration tests that verify end-to-end connectivity against the SASL test stack from `docker/docker-compose.sasl-test.yml`. Tests are skipped in normal CI because the stack is not always running.

**Files:**
- Modify: `backend/src/test/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapterIT.java`

**Prerequisite:** Start the SASL test stack before running:

```bash
docker compose -f docker/docker-compose.sasl-test.yml up -d
# Wait ~30s for redpanda-init to complete
docker logs dls-sasl-redpanda-init   # should end with "Bootstrap complete."
```

- [ ] **Step 1: Add SASL + SR tests to KafkaConnectivityAdapterIT**

Add these four tests to the existing class. Also add the import at the top of the file:

```java
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import it.dls.domain.cluster.SchemaRegistryAuthConfig;
```

Tests to add (inside the class, after the existing two tests):

```java
// Run with: ./gradlew test -Dsasl.test.enabled=true
// Requires: docker compose -f docker/docker-compose.sasl-test.yml up -d

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testKafka_saslScram256_saslPlaintext_succeeds() {
    var security = KafkaSecurityConfig.saslScram256("admin", "admin-secret", false);
    var result = connectivity.testKafka("localhost:19092", security);
    assertThat(result.success()).isTrue();
}

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testKafka_saslScram256_wrongPassword_fails() {
    var security = KafkaSecurityConfig.saslScram256("admin", "wrong-password", false);
    var result = connectivity.testKafka("localhost:19092", security);
    assertThat(result.success()).isFalse();
    assertThat(result.errorMessage()).isNotBlank();
}

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testSchemaRegistry_basicAuth_succeeds() {
    var auth = new SchemaRegistryAuthConfig("sr-reader", "sr-reader-secret");
    var result = connectivity.testSchemaRegistry("http://localhost:18081", auth);
    assertThat(result.success()).isTrue();
}

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testSchemaRegistry_wrongPassword_fails() {
    var auth = new SchemaRegistryAuthConfig("sr-reader", "wrong-password");
    var result = connectivity.testSchemaRegistry("http://localhost:18081", auth);
    assertThat(result.success()).isFalse();
}
```

- [ ] **Step 2: Run normal tests — confirm the gated tests are skipped**

```bash
cd backend
./gradlew :test --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT"
```

Expected: 2 tests pass, 4 tests skipped (condition `sasl.test.enabled` not set).

- [ ] **Step 3: Run with SASL stack enabled**

Make sure the SASL test stack is up (see Task 6 prerequisite), then:

```bash
cd backend
./gradlew :test --tests "it.dls.infrastructure.kafka.KafkaConnectivityAdapterIT" \
  -Dsasl.test.enabled=true
```

Expected: 6 tests pass — including the 4 SASL/SR tests. If any fail, check:
- `docker logs dls-sasl-redpanda-init` — did bootstrap complete?
- `docker logs dls-sasl-schema-registry` — is Schema Registry healthy?
- `curl http://localhost:19644/v1/status/ready` — is Redpanda ready?

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapterIT.java
git commit -m "test(infra): add gated SASL/SCRAM + SR basic-auth connectivity IT tests"
```

---

## Final Verification

Run the full backend test suite to confirm no regressions:

```bash
cd backend
./gradlew test
```

Expected: BUILD SUCCESSFUL. All existing tests pass. The 4 SASL IT tests are skipped (not enabled).
