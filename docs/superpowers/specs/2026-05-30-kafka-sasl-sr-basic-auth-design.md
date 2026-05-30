# Design: SASL/SCRAM Kafka Auth + Schema Registry Basic Auth

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** Backend only — domain, application, infrastructure layers + Flyway migration + IT tests

---

## Problem

Two bugs block SASL/SCRAM connectivity:

1. `KafkaSecurityPropsBuilder` and `KafkaConnectivityAdapter.buildKafkaProperties` always emit `security.protocol=SASL_SSL` for all SASL variants. Clusters without TLS transport (e.g. `SASL_PLAINTEXT`) cannot connect.

2. `ManageClusterUseCase.registerCluster` builds one `KafkaSecurityConfig` using `encryption.encrypt()` calls, then passes that encrypted config to `connectivity.testKafka()` and `connectivity.testSchemaRegistry()`. SASL auth fails because the JAAS config / Basic Auth header contains AES-encrypted gibberish instead of plaintext credentials.

Schema Registry basic auth is already correctly wired in `ConfluentSchemaRegistryAdapter.buildClient` — no change needed there.

---

## Design

### 1. Domain — `KafkaSecurityConfig`

Add `boolean tlsEnabled` as second field:

```java
public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    boolean tlsEnabled,           // for SASL_* only; ignored by PLAINTEXT and SSL
    String encryptedUsername,
    String encryptedPassword,
    String encryptedKeystorePem
)
```

**Semantics:**
- `PLAINTEXT` — `tlsEnabled` irrelevant, transport is always unencrypted
- `SSL` — `tlsEnabled` irrelevant, transport is always TLS (mTLS)
- `SASL_*` — `tlsEnabled=true` → `SASL_SSL`; `tlsEnabled=false` → `SASL_PLAINTEXT`

**Updated factory methods** (all callers updated, no overloads kept):
```java
static KafkaSecurityConfig plaintext()
static KafkaSecurityConfig ssl(String encKeystorePem)
static KafkaSecurityConfig saslPlain(String encUser, String encPass, boolean tlsEnabled)
static KafkaSecurityConfig saslScram256(String encUser, String encPass, boolean tlsEnabled)
static KafkaSecurityConfig saslScram512(String encUser, String encPass, boolean tlsEnabled)
```

`RegisterClusterCommand` gains `boolean tlsEnabled`.

---

### 2. Infrastructure — Kafka props builders

Both `KafkaSecurityPropsBuilder.base()` and `KafkaConnectivityAdapter.buildKafkaProperties()` switch on `security.tlsEnabled()` for SASL cases:

```java
case SASL_SCRAM_SHA_256 -> {
    props.put("security.protocol",
        security.tlsEnabled() ? "SASL_SSL" : "SASL_PLAINTEXT");
    props.put(SaslConfigs.SASL_MECHANISM, "SCRAM-SHA-256");
    props.put(SaslConfigs.SASL_JAAS_CONFIG, buildJaas(
        "org.apache.kafka.common.security.scram.ScramLoginModule",
        security.encryptedUsername(), security.encryptedPassword()));
}
// same pattern for SASL_SCRAM_SHA_512 and SASL_PLAIN
```

`KafkaClusterEntity` gains:
```java
@Column(name = "tls_enabled")
public boolean tlsEnabled;
```
`fromDomain` / `toDomain` updated accordingly.

`CreateClusterRequest` gains `Boolean tlsEnabled` (nullable). `ClusterResource` passes it through to `RegisterClusterCommand`, defaulting `null` → `true`.

---

### 3. Application — fix encryption bug in `registerCluster`

Replace single `buildSecurityConfig(cmd)` with two separate configs:

```java
// plaintext — used only for connectivity test, never persisted
var plainSecurity = buildPlainSecurityConfig(cmd);
connectivity.testKafka(cmd.bootstrapServers(), plainSecurity);  // uses real credentials

// encrypted — persisted only
var encSecurity = buildEncryptedSecurityConfig(cmd);

// SR: same split
if (cmd.srUrl() != null && !cmd.srUrl().isBlank()) {
    var plainSrAuth = new SchemaRegistryAuthConfig(cmd.srUsername(), cmd.srPassword());
    connectivity.testSchemaRegistry(cmd.srUrl(), plainSrAuth);  // uses real credentials

    srConfig = new SchemaRegistryConfig(cmd.srUrl(),
        cmd.srUsername() != null ? encryption.encrypt(cmd.srUsername()) : null,
        cmd.srPassword() != null ? encryption.encrypt(cmd.srPassword()) : null);
}

var cluster = KafkaCluster.create(..., encSecurity, srConfig);  // persisted encrypted
```

`buildPlainSecurityConfig(cmd)` constructs `KafkaSecurityConfig` with raw credential strings.  
`buildEncryptedSecurityConfig(cmd)` wraps them with `encryption.encrypt()` — replaces the current `buildSecurityConfig`.

---

### 4. DB Migration — V7

```sql
ALTER TABLE kafka_clusters
  ADD COLUMN tls_enabled BOOLEAN NOT NULL DEFAULT TRUE;
```

Default `TRUE` preserves behaviour for existing rows (all previously registered with `SASL_SSL` assumption).

---

### 5. Testing

**Unit tests** — update construction sites:
- `KafkaClusterTest`: `saslPlain("enc-user", "enc-pass")` → `saslPlain("enc-user", "enc-pass", true)`
- `ManageClusterUseCaseTest`: `RegisterClusterCommand` gains `tlsEnabled` arg

**New IT tests** in `KafkaConnectivityAdapterIT` — gated by system property so they skip in normal CI:

```java
// Requires: docker compose -f docker/docker-compose.sasl-test.yml up -d
// Run with: ./gradlew test -Dsasl.test.enabled=true

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testKafka_saslScram256_noTls() {
    var security = KafkaSecurityConfig.saslScram256("admin", "admin-secret", false);
    assertTrue(connectivity.testKafka("localhost:19092", security).success());
}

@Test
@EnabledIfSystemProperty(named = "sasl.test.enabled", matches = "true")
void testSchemaRegistry_basicAuth() {
    var auth = new SchemaRegistryAuthConfig("sr-reader", "sr-reader-secret");
    assertTrue(connectivity.testSchemaRegistry("http://localhost:18081", auth).success());
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `domain/cluster/KafkaSecurityConfig.java` | Add `tlsEnabled`, update factory methods |
| `application/cluster/RegisterClusterCommand.java` | Add `tlsEnabled` |
| `application/cluster/ManageClusterUseCase.java` | Fix encryption bug, split plain/encrypted configs |
| `infrastructure/kafka/KafkaSecurityPropsBuilder.java` | `SASL_SSL` vs `SASL_PLAINTEXT` based on `tlsEnabled` |
| `infrastructure/kafka/KafkaConnectivityAdapter.java` | Same fix |
| `infrastructure/persistence/KafkaClusterEntity.java` | Add `tls_enabled` field |
| `infrastructure/api/cluster/CreateClusterRequest.java` | Add `Boolean tlsEnabled` |
| `infrastructure/api/cluster/ClusterResource.java` | Pass `tlsEnabled` to command |
| `resources/db/migration/V7__add_tls_enabled.sql` | New migration |
| `test/.../KafkaClusterTest.java` | Update `saslPlain` call |
| `test/.../ManageClusterUseCaseTest.java` | Update command construction |
| `test/.../KafkaConnectivityAdapterIT.java` | Add 2 gated SASL/SR IT tests |

---

## Out of Scope

- Frontend cluster creation UI (`tlsEnabled` toggle) — separate task
- `SASL_SCRAM_SHA_256_SSL` TLS certificate trust config — current SSL impl uses PEM keystore; left for future
- `ConfluentSchemaRegistryAdapter` — no change needed
