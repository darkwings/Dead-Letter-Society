# Dead Letter Society — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web application to monitor, inspect, annotate, and replay messages from Kafka Dead Letter Queues across multiple clusters, with multi-user access control and both standalone and OIDC authentication.

**Architecture:** Hexagonal (ports & adapters) DDD backend in Quarkus 3.33.1 + Gradle 9. React 18 + Vite + TypeScript + shadcn/ui frontend. PostgreSQL for persistence. SSE for real-time notifications. All domain logic is framework-free; infrastructure adapters implement domain ports.

**Tech Stack:** Java 21, Quarkus 3.33.1, Gradle 9, PostgreSQL 16, Flyway, Hibernate ORM Panache, Apache Kafka client, Confluent Schema Registry client, Quarkus OIDC, Quarkus Scheduler, Mutiny SSE — React 18, Vite 6, TypeScript 5, shadcn/ui, Tailwind CSS v4, TanStack Query v5, React Router v6, Zustand, Zod, Playwright.

**Terminology:** All terms from `TERMS.md`. Requirements from `EVALUATION.md`.

**Local Development Strategy:**
- **Primary (default):** Quarkus Dev Services — zero config. Running `./gradlew quarkusDev` automatically spins up PostgreSQL + Kafka + Schema Registry via Testcontainers/OrbStack. No `.env` needed.
- **Optional (explicit Docker):** `docker/docker-compose.dev.yml` spins up the same services manually. Used by those who prefer explicit container management. When active, Dev Services must be disabled in `application.properties` to avoid port conflicts (see Task 0.4).

---

## Repository Structure

```
dead-letter-society/
├── backend/                          # Quarkus app
│   ├── build.gradle
│   ├── settings.gradle
│   └── src/
│       ├── main/java/it/dls/
│       │   ├── domain/
│       │   │   ├── cluster/          # KafkaCluster aggregate
│       │   │   ├── dlqconfig/        # DlqConfig aggregate
│       │   │   ├── message/          # DlqMessage aggregate
│       │   │   ├── user/             # User aggregate
│       │   │   └── shared/           # Value objects, domain events, ports
│       │   ├── application/          # Use cases
│       │   │   ├── fetch/
│       │   │   ├── replay/
│       │   │   ├── inspection/
│       │   │   ├── cluster/
│       │   │   └── identity/
│       │   └── infrastructure/
│       │       ├── kafka/
│       │       ├── schemaregistry/
│       │       ├── persistence/
│       │       ├── security/
│       │       ├── notification/
│       │       └── api/              # REST controllers
│       ├── main/resources/
│       │   ├── application.properties
│       │   └── db/migration/         # Flyway SQL migrations
│       └── test/java/it/dls/
├── frontend/                         # Vite + React app
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                      # OpenAPI-generated client + hooks
│       ├── components/               # shadcn/ui + custom
│       ├── pages/
│       ├── hooks/                    # useSSE, useAuth, etc.
│       └── stores/                   # Zustand
│   └── e2e/                          # Playwright specs
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── DOMAIN.md
├── TERMS.md
├── EVALUATION.md
└── POST-MVP.md
```

---

## Phase 0 — Foundation

**Goal:** Working monorepo with backend scaffold (Quarkus + Gradle 9), frontend scaffold (React + Vite), Docker Compose (dev + prod), Quarkus Dev Services wired for local development.

---

### Task 0.1 — Backend scaffold (Quarkus + Gradle 9)

**Files:**
- Create: `backend/settings.gradle`
- Create: `backend/build.gradle`
- Create: `backend/gradle/wrapper/gradle-wrapper.properties`
- Create: `backend/src/main/resources/application.properties`

- [ ] **Step 1: Generate Quarkus project skeleton**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society
curl -O -J 'https://code.quarkus.io/d?v=3.33.1&b=GRADLE&j=21&g=it.dls&a=dead-letter-society-backend&p=it.dls&e=rest-jackson&e=hibernate-orm-panache&e=jdbc-postgresql&e=flyway&e=scheduler&e=security&e=oidc&e=smallrye-jwt&e=smallrye-reactive-messaging-kafka&e=rest-client-reactive-jackson&e=container-image-docker' 2>/dev/null || true
```

Or create manually. The `settings.gradle` must be:

```groovy
rootProject.name = 'dead-letter-society-backend'
```

- [ ] **Step 2: Write `build.gradle`**

```groovy
plugins {
    id 'java'
    id 'io.quarkus' version '3.33.1'
}

repositories {
    mavenCentral()
    maven { url 'https://packages.confluent.io/maven/' }
}

dependencies {
    implementation enforcedPlatform("io.quarkus.platform:quarkus-bom:3.33.1")
    implementation 'io.quarkus:quarkus-rest-jackson'
    implementation 'io.quarkus:quarkus-hibernate-orm-panache'
    implementation 'io.quarkus:quarkus-jdbc-postgresql'
    implementation 'io.quarkus:quarkus-flyway'
    implementation 'io.quarkus:quarkus-scheduler'
    implementation 'io.quarkus:quarkus-security'
    implementation 'io.quarkus:quarkus-elytron-security-jdbc'
    implementation 'io.quarkus:quarkus-oidc'
    implementation 'io.quarkus:quarkus-smallrye-jwt'
    implementation 'io.quarkus:quarkus-rest-client-reactive-jackson'
    implementation 'io.quarkus:quarkus-smallrye-reactive-messaging-kafka'
    implementation 'io.confluent:kafka-schema-registry-client:7.8.0'
    implementation 'org.apache.avro:avro:1.12.0'
    implementation 'com.google.protobuf:protobuf-java:4.29.3'

    testImplementation 'io.quarkus:quarkus-junit5'
    testImplementation 'io.rest-assured:rest-assured'
    testImplementation 'io.quarkus:quarkus-test-security'
    testImplementation 'org.testcontainers:testcontainers:1.21.0'
    testImplementation 'org.testcontainers:kafka:1.21.0'
    testImplementation 'org.testcontainers:postgresql:1.21.0'
    testImplementation 'org.testcontainers:keycloak:1.21.0'
    testImplementation 'org.mockito:mockito-core:5.15.2'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

test {
    systemProperty 'java.util.logging.manager', 'org.jboss.logmanager.LogManager'
}
```

- [ ] **Step 3: Write `application.properties`**

```properties
# Application
quarkus.application.name=dead-letter-society

# DataSource — overridden by Dev Services in dev/test mode
%prod.quarkus.datasource.db-kind=postgresql
%prod.quarkus.datasource.username=${DB_USER:dls}
%prod.quarkus.datasource.password=${DB_PASSWORD}
%prod.quarkus.datasource.jdbc.url=jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:dls}

# Flyway
quarkus.flyway.migrate-at-start=true
quarkus.flyway.locations=classpath:db/migration

# Hibernate
quarkus.hibernate-orm.database.generation=none

# Dev Services (active in dev + test automatically)
quarkus.datasource.devservices.enabled=true
quarkus.datasource.devservices.image-name=postgres:16-alpine

# Kafka Dev Services
quarkus.kafka.devservices.enabled=true
quarkus.kafka.devservices.image-name=confluentinc/cp-kafka:7.8.0

# Encryption key (REQUIRED in prod)
dls.encryption.key=${DLS_ENCRYPTION_KEY:dev-only-insecure-key-32-chars!!}

# HTTP
quarkus.http.port=8080
%prod.quarkus.http.ssl-port=8443
```

- [ ] **Step 4: Verify build**

```bash
cd backend && ./gradlew quarkusDev --no-daemon
```

Expected: Quarkus starts on port 8080, Dev Services spin up PostgreSQL + Kafka via OrbStack.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Quarkus 3.33.1 backend with Gradle 9"
```

---

### Task 0.2 — First Flyway migration (empty schema marker)

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__init.sql`

- [ ] **Step 1: Create baseline migration**

```sql
-- V1__init.sql
-- baseline: schema versioning starts here
-- tables added in subsequent migrations per feature phase
```

- [ ] **Step 2: Run migration**

```bash
./gradlew quarkusDev
```

Expected: Flyway logs `Successfully applied 1 migration`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/
git commit -m "chore: add Flyway baseline migration V1"
```

---

### Task 0.3 — Frontend scaffold (React + Vite + TypeScript + shadcn/ui)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/components.json` (shadcn/ui config)
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/francotorriani/Development/WebApps/Dead-Letter-Society
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @tanstack/react-query@5 react-router-dom@6 zustand zod react-hook-form @hookform/resolvers
npm install -D tailwindcss@4 @tailwindcss/vite autoprefixer
npx shadcn@latest init
```

shadcn/ui init answers: TypeScript=yes, style=New York, base color=Zinc, CSS variables=yes.

- [ ] **Step 3: Write `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 4: Write minimal `src/App.tsx`**

```typescript
export default function App() {
  return <div className="min-h-screen bg-background text-foreground p-8">
    <h1 className="text-3xl font-bold">Dead Letter Society</h1>
    <p className="text-muted-foreground mt-2">Loading...</p>
  </div>
}
```

- [ ] **Step 5: Verify frontend starts**

```bash
npm run dev
```

Expected: App at http://localhost:5173, title "Dead Letter Society" visible.

- [ ] **Step 6: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `e2e/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('app loads', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.getByText('Dead Letter Society')).toBeVisible()
})
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React 18 + Vite + shadcn/ui frontend"
```

---

### Task 0.4 — Docker Compose (dev + prod)

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/docker-compose.dev.yml`
- Create: `docker/.env.example`

**Note on Dev Services vs explicit Docker:**
- Default local dev uses Dev Services (zero config). No Docker Compose needed.
- `docker-compose.dev.yml` is opt-in. To use it, start it first and then add `%dev.quarkus.devservices.enabled=false` to `application.properties` (or pass `-Dquarkus.devservices.enabled=false`). This prevents Dev Services from spinning up duplicate containers.

- [ ] **Step 1: Write `docker-compose.yml` (production)**

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME:-dls}
      POSTGRES_USER: ${DB_USER:-dls}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD required}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-dls}"]
      interval: 10s
      retries: 5

  backend:
    image: dead-letter-society-backend:latest
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
      DB_NAME: ${DB_NAME:-dls}
      DB_USER: ${DB_USER:-dls}
      DB_PASSWORD: ${DB_PASSWORD}
      DLS_ENCRYPTION_KEY: ${DLS_ENCRYPTION_KEY:?DLS_ENCRYPTION_KEY required}
      QUARKUS_OIDC_ENABLED: ${OIDC_ENABLED:-false}
      QUARKUS_OIDC_AUTH_SERVER_URL: ${OIDC_SERVER_URL:-}
      QUARKUS_OIDC_CLIENT_ID: ${OIDC_CLIENT_ID:-}
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: dead-letter-society-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  db_data:
```

- [ ] **Step 2: Write `docker-compose.dev.yml` (optional explicit local containers)**

```yaml
version: '3.9'
# Optional alternative to Quarkus Dev Services.
# Usage:
#   docker compose -f docker-compose.dev.yml up -d
#   Then run Quarkus with: ./gradlew quarkusDev -Dquarkus.devservices.enabled=false

services:
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: dls
      POSTGRES_USER: dls
      POSTGRES_PASSWORD: dls

  kafka:
    image: confluentinc/cp-kafka:7.8.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk

  schema-registry:
    image: confluentinc/cp-schema-registry:7.8.0
    ports:
      - "8081:8081"
    environment:
      SCHEMA_REGISTRY_HOST_NAME: schema-registry
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: kafka:9092
    depends_on:
      - kafka
```

When this compose file is running, start Quarkus with Dev Services disabled:
```bash
./gradlew quarkusDev -Dquarkus.devservices.enabled=false \
  -Dquarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/dls \
  -Dquarkus.datasource.username=dls \
  -Dquarkus.datasource.password=dls \
  -Dkafka.bootstrap.servers=localhost:9092
```

- [ ] **Step 3: Write `.env.example`**

```
DB_NAME=dls
DB_USER=dls
DB_PASSWORD=changeme
DLS_ENCRYPTION_KEY=change-this-to-a-32-char-secret!!
OIDC_ENABLED=false
OIDC_SERVER_URL=
OIDC_CLIENT_ID=
```

- [ ] **Step 3: Commit**

```bash
git add docker/
git commit -m "feat: add Docker Compose for dev and production"
```

---

## Phase 1 — Identity & Access

**Goal:** User domain aggregate, standalone authentication (first-run setup, login, lockout), OIDC federation, role enforcement (ADMIN / VIEWER / OPERATOR), JWT session.

**EVALUATION.md coverage:** AUTH-001 → AUTH-015

---

### Task 1.1 — User domain aggregate

**Files:**
- Create: `backend/src/main/java/it/dls/domain/user/User.java`
- Create: `backend/src/main/java/it/dls/domain/user/GlobalRole.java`
- Create: `backend/src/main/java/it/dls/domain/user/AuthProvider.java`
- Create: `backend/src/main/java/it/dls/domain/user/UserRepository.java` (port)
- Create: `backend/src/test/java/it/dls/domain/user/UserTest.java`

- [ ] **Step 1: Write `GlobalRole` and `AuthProvider` enums**

```java
// it/dls/domain/user/GlobalRole.java
package it.dls.domain.user;
public enum GlobalRole { ADMIN, USER }

// it/dls/domain/user/AuthProvider.java
package it.dls.domain.user;
public enum AuthProvider { LOCAL, OIDC }
```

- [ ] **Step 2: Write failing test**

```java
// UserTest.java
package it.dls.domain.user;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class UserTest {

    @Test
    void firstUserBecomesAdmin() {
        var user = User.createLocal("admin@dls.io", "Admin User", "hashedpwd");
        user.promoteToAdmin();
        assertThat(user.getGlobalRole()).isEqualTo(GlobalRole.ADMIN);
    }

    @Test
    void lockedUserCannotAuthenticate() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        assertThat(user.isLocked()).isTrue();
    }

    @Test
    void adminCanUnlockUser() {
        var user = User.createLocal("user@dls.io", "User", "hashedpwd");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        user.unlock();
        assertThat(user.isLocked()).isFalse();
        assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
    }
}
```

- [ ] **Step 3: Run test — expect FAIL** (`User not defined`)

```bash
./gradlew test --tests "it.dls.domain.user.UserTest"
```

- [ ] **Step 4: Implement `User` aggregate**

```java
package it.dls.domain.user;

import java.util.UUID;

public class User {
    private final UUID id;
    private final String email;
    private String displayName;
    private final AuthProvider authProvider;
    private GlobalRole globalRole;
    private String passwordHash;
    private String oidcSubject;
    private int failedLoginAttempts;
    private boolean locked;

    private User(UUID id, String email, String displayName,
                 AuthProvider provider, String passwordHash, String oidcSubject) {
        this.id = id;
        this.email = email;
        this.displayName = displayName;
        this.authProvider = provider;
        this.globalRole = GlobalRole.USER;
        this.passwordHash = passwordHash;
        this.oidcSubject = oidcSubject;
    }

    public static User createLocal(String email, String displayName, String passwordHash) {
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.LOCAL, passwordHash, null);
    }

    public static User createOidc(String email, String displayName, String subject) {
        return new User(UUID.randomUUID(), email, displayName,
                        AuthProvider.OIDC, null, subject);
    }

    public void promoteToAdmin() { this.globalRole = GlobalRole.ADMIN; }

    public void recordFailedLoginAttempt() {
        this.failedLoginAttempts++;
        if (this.failedLoginAttempts >= 5) this.locked = true;
    }

    public void resetFailedAttempts() { this.failedLoginAttempts = 0; }

    public void unlock() {
        this.locked = false;
        this.failedLoginAttempts = 0;
    }

    public boolean isLocked() { return locked; }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public GlobalRole getGlobalRole() { return globalRole; }
    public AuthProvider getAuthProvider() { return authProvider; }
    public String getPasswordHash() { return passwordHash; }
    public String getOidcSubject() { return oidcSubject; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
./gradlew test --tests "it.dls.domain.user.UserTest"
```

- [ ] **Step 6: Write `UserRepository` port (outbound)**

```java
package it.dls.domain.user;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    void save(User user);
    Optional<User> findById(UUID id);
    Optional<User> findByEmail(String email);
    Optional<User> findByOidcSubject(String subject);
    boolean existsAny();
}
```

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(domain): User aggregate with lockout and role management"
```

---

### Task 1.2 — Flyway migration V2: users table

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__users.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255) NOT NULL,
    auth_provider VARCHAR(10)  NOT NULL CHECK (auth_provider IN ('LOCAL','OIDC')),
    global_role   VARCHAR(10)  NOT NULL DEFAULT 'USER' CHECK (global_role IN ('ADMIN','USER')),
    password_hash VARCHAR(255),
    oidc_subject  VARCHAR(255),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oidc_subject ON users(oidc_subject) WHERE oidc_subject IS NOT NULL;
```

- [ ] **Step 2: Verify migration runs**

```bash
./gradlew quarkusDev
```

Expected: `Successfully applied 1 migration to schema "public" (V2__users)`.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(db): V2 users table migration"
```

---

### Task 1.3 — UserRepository Panache adapter

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/UserEntity.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/UserRepositoryAdapter.java`
- Create: `backend/src/test/java/it/dls/infrastructure/persistence/UserRepositoryAdapterIT.java`

- [ ] **Step 1: Write `UserEntity` (Panache)**

```java
package it.dls.infrastructure.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import it.dls.domain.user.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity extends PanacheEntityBase {

    @Id
    @Column(columnDefinition = "uuid")
    public UUID id;

    public String email;
    public String displayName;

    @Enumerated(EnumType.STRING)
    public AuthProvider authProvider;

    @Enumerated(EnumType.STRING)
    public GlobalRole globalRole;

    public String passwordHash;
    public String oidcSubject;
    public int failedLoginAttempts;
    public boolean locked;
    public Instant createdAt;
    public Instant updatedAt;

    public static UserEntity fromDomain(User u) {
        var e = new UserEntity();
        e.id = u.getId();
        e.email = u.getEmail();
        e.displayName = u.getDisplayName();
        e.authProvider = u.getAuthProvider();
        e.globalRole = u.getGlobalRole();
        e.passwordHash = u.getPasswordHash();
        e.oidcSubject = u.getOidcSubject();
        e.failedLoginAttempts = u.getFailedLoginAttempts();
        e.locked = u.isLocked();
        e.createdAt = Instant.now();
        e.updatedAt = Instant.now();
        return e;
    }

    public User toDomain() {
        var u = authProvider == AuthProvider.LOCAL
            ? User.createLocal(email, displayName, passwordHash)
            : User.createOidc(email, displayName, oidcSubject);
        if (globalRole == GlobalRole.ADMIN) u.promoteToAdmin();
        for (int i = 0; i < failedLoginAttempts; i++) {
            // restore state without triggering lockout side effects
        }
        return u;
    }
}
```

- [ ] **Step 2: Write integration test**

```java
@QuarkusTest
class UserRepositoryAdapterIT {

    @Inject UserRepository repo;

    @Test
    @Transactional
    void saveAndFindByEmail() {
        var user = User.createLocal("it@dls.io", "IT User", "hash");
        repo.save(user);
        var found = repo.findByEmail("it@dls.io");
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("it@dls.io");
    }

    @Test
    @Transactional
    void existsAnyReturnsFalseOnEmptyDb() {
        assertThat(repo.existsAny()).isFalse();
    }
}
```

- [ ] **Step 3: Implement `UserRepositoryAdapter`**

```java
package it.dls.infrastructure.persistence;

import it.dls.domain.user.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class UserRepositoryAdapter implements UserRepository {

    @Override
    @Transactional
    public void save(User user) {
        var existing = UserEntity.<UserEntity>findById(user.getId());
        if (existing == null) {
            UserEntity.fromDomain(user).persist();
        } else {
            existing.globalRole = user.getGlobalRole();
            existing.failedLoginAttempts = user.getFailedLoginAttempts();
            existing.locked = user.isLocked();
            existing.updatedAt = java.time.Instant.now();
        }
    }

    @Override
    public Optional<User> findById(UUID id) {
        return UserEntity.<UserEntity>findByIdOptional(id).map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return UserEntity.<UserEntity>find("email", email).firstResultOptional()
                         .map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByOidcSubject(String subject) {
        return UserEntity.<UserEntity>find("oidcSubject", subject).firstResultOptional()
                         .map(UserEntity::toDomain);
    }

    @Override
    public boolean existsAny() {
        return UserEntity.count() > 0;
    }
}
```

- [ ] **Step 4: Run integration tests**

```bash
./gradlew test --tests "it.dls.infrastructure.persistence.UserRepositoryAdapterIT"
```

Expected: PASS (Dev Services spins PostgreSQL automatically).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(infra): UserRepository Panache adapter with integration tests"
```

---

### Task 1.4 — Authentication use cases (standalone)

**Files:**
- Create: `backend/src/main/java/it/dls/application/identity/RegisterAdminUseCase.java`
- Create: `backend/src/main/java/it/dls/application/identity/LoginUseCase.java`
- Create: `backend/src/main/java/it/dls/application/identity/PasswordHashPort.java`
- Create: `backend/src/main/java/it/dls/infrastructure/security/BcryptPasswordHashAdapter.java`
- Create: `backend/src/test/java/it/dls/application/identity/LoginUseCaseTest.java`

- [ ] **Step 1: Write `PasswordHashPort`**

```java
package it.dls.application.identity;
public interface PasswordHashPort {
    String hash(String plaintext);
    boolean verify(String plaintext, String hash);
}
```

- [ ] **Step 2: Write failing tests**

```java
class LoginUseCaseTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final PasswordHashPort hasher = mock(PasswordHashPort.class);
    private final LoginUseCase useCase = new LoginUseCase(repo, hasher);

    @Test
    void lockedAccountReturnsFailure() {
        var user = User.createLocal("u@dls.io", "U", "hash");
        for (int i = 0; i < 5; i++) user.recordFailedLoginAttempt();
        when(repo.findByEmail("u@dls.io")).thenReturn(Optional.of(user));
        var result = useCase.login("u@dls.io", "any");
        assertThat(result.isFailure()).isTrue();
        assertThat(result.failureReason()).isEqualTo(LoginFailure.ACCOUNT_LOCKED);
    }

    @Test
    void wrongPasswordIncrementsCounter() {
        var user = User.createLocal("u@dls.io", "U", "hash");
        when(repo.findByEmail("u@dls.io")).thenReturn(Optional.of(user));
        when(hasher.verify("wrong", "hash")).thenReturn(false);
        useCase.login("u@dls.io", "wrong");
        verify(repo).save(argThat(u -> u.getFailedLoginAttempts() == 1));
    }
}
```

- [ ] **Step 3: Implement `LoginUseCase`**

```java
package it.dls.application.identity;

import it.dls.domain.user.*;
import java.util.Optional;

public class LoginUseCase {

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public LoginUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    public LoginResult login(String email, String password) {
        Optional<User> maybeUser = userRepository.findByEmail(email);
        if (maybeUser.isEmpty()) return LoginResult.failure(LoginFailure.INVALID_CREDENTIALS);

        User user = maybeUser.get();
        if (user.isLocked()) return LoginResult.failure(LoginFailure.ACCOUNT_LOCKED);

        if (!passwordHash.verify(password, user.getPasswordHash())) {
            user.recordFailedLoginAttempt();
            userRepository.save(user);
            return LoginResult.failure(LoginFailure.INVALID_CREDENTIALS);
        }

        user.resetFailedAttempts();
        userRepository.save(user);
        return LoginResult.success(user);
    }
}
```

- [ ] **Step 4: Implement `RegisterAdminUseCase`**

```java
package it.dls.application.identity;

import it.dls.domain.user.*;

public class RegisterAdminUseCase {

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public RegisterAdminUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    public User registerFirstAdmin(String email, String displayName, String password) {
        if (userRepository.existsAny()) {
            throw new IllegalStateException("Setup already completed. First admin already exists.");
        }
        var user = User.createLocal(email, displayName, passwordHash.hash(password));
        user.promoteToAdmin();
        userRepository.save(user);
        return user;
    }
}
```

- [ ] **Step 5: Run tests**

```bash
./gradlew test --tests "it.dls.application.identity.*"
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(application): LoginUseCase and RegisterAdminUseCase with TDD"
```

---

### Task 1.5 — Auth REST API + JWT + first-run endpoint

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/api/auth/AuthResource.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/auth/SetupResource.java`
- Create: `backend/src/test/java/it/dls/infrastructure/api/auth/AuthResourceIT.java`

Key endpoints:

```
POST /api/setup          — register first admin (EVALUATION AUTH-001, AUTH-002)
POST /api/auth/login     — standalone login (returns JWT)
GET  /api/auth/me        — current user info
POST /api/auth/logout    — invalidate session
```

- [ ] **Step 1: Write `SetupResource`**

```java
@Path("/api/setup")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SetupResource {

    @Inject RegisterAdminUseCase registerAdmin;
    @Inject UserRepository userRepository;

    @GET
    @Path("/status")
    public SetupStatusResponse status() {
        return new SetupStatusResponse(!userRepository.existsAny());
    }

    @POST
    public Response createAdmin(CreateAdminRequest req) {
        if (userRepository.existsAny()) {
            return Response.status(Response.Status.CONFLICT)
                .entity(new ErrorResponse("SETUP_ALREADY_DONE", "Setup already completed")).build();
        }
        var user = registerAdmin.registerFirstAdmin(req.email(), req.displayName(), req.password());
        return Response.status(Response.Status.CREATED)
            .entity(UserResponse.from(user)).build();
    }
}
```

- [ ] **Step 2: Write integration test**

```java
@QuarkusTest
class AuthResourceIT {

    @Test
    void setupStatusReturnsTrueOnEmptyDb() {
        given().when().get("/api/setup/status")
            .then().statusCode(200)
            .body("setupRequired", is(true));
    }

    @Test
    @Transactional
    void createFirstAdminSucceeds() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"email":"admin@dls.io","displayName":"Admin","password":"Secure123!"}
                """)
            .when().post("/api/setup")
            .then().statusCode(201)
            .body("email", equalTo("admin@dls.io"))
            .body("globalRole", equalTo("ADMIN"));
    }
}
```

- [ ] **Step 3: Configure Quarkus JWT in `application.properties`**

```properties
mp.jwt.verify.publickey.location=META-INF/resources/publicKey.pem
mp.jwt.verify.issuer=https://dls.io
smallrye.jwt.sign.key.location=META-INF/resources/privateKey.pem
```

Generate keys:

```bash
openssl genrsa -out backend/src/main/resources/META-INF/resources/privateKey.pem 2048
openssl rsa -in backend/src/main/resources/META-INF/resources/privateKey.pem \
            -pubout -out backend/src/main/resources/META-INF/resources/publicKey.pem
```

**Note:** In production, keys come from env vars. Dev keys are committed for local development only.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(api): auth endpoints — setup, login, JWT"
```

---

### Task 1.6 — OIDC integration + role claim mapping

**Files:**
- Modify: `backend/src/main/resources/application.properties`
- Create: `backend/src/main/java/it/dls/application/identity/OidcLoginUseCase.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/auth/OidcCallbackResource.java`

- [ ] **Step 1: Add OIDC config to `application.properties`**

```properties
# OIDC (disabled by default, enabled via env var)
quarkus.oidc.enabled=${QUARKUS_OIDC_ENABLED:false}
quarkus.oidc.auth-server-url=${QUARKUS_OIDC_AUTH_SERVER_URL:}
quarkus.oidc.client-id=${QUARKUS_OIDC_CLIENT_ID:dls}
quarkus.oidc.application-type=service

# ADMIN claim mapping (configurable)
dls.oidc.admin-claim-name=${DLS_OIDC_ADMIN_CLAIM:roles}
dls.oidc.admin-claim-value=${DLS_OIDC_ADMIN_VALUE:dls-admin}
```

- [ ] **Step 2: Implement `OidcLoginUseCase`**

```java
public class OidcLoginUseCase {

    private final UserRepository userRepository;
    private final String adminClaimName;
    private final String adminClaimValue;

    public User loginOrProvision(String subject, String email,
                                 String displayName, JsonObject claims) {
        return userRepository.findByOidcSubject(subject)
            .map(user -> syncAdminRole(user, claims))
            .orElseGet(() -> provision(subject, email, displayName, claims));
    }

    private User provision(String subject, String email,
                           String displayName, JsonObject claims) {
        var user = User.createOidc(email, displayName, subject);
        if (hasAdminClaim(claims)) user.promoteToAdmin();
        userRepository.save(user);
        return user;
    }

    private User syncAdminRole(User user, JsonObject claims) {
        if (hasAdminClaim(claims)) user.promoteToAdmin();
        userRepository.save(user);
        return user;
    }

    private boolean hasAdminClaim(JsonObject claims) {
        var claim = claims.getJsonArray(adminClaimName);
        return claim != null && claim.getValuesAs(JsonString.class)
                                     .stream()
                                     .anyMatch(v -> adminClaimValue.equals(v.getString()));
    }
}
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(oidc): OIDC auto-provisioning with ADMIN claim mapping"
```

---

### Task 1.7 — Frontend: Auth pages (setup, login, route guard)

**Files:**
- Create: `frontend/src/pages/SetupPage.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/components/RouteGuard.tsx`
- Create: `frontend/src/stores/authStore.ts`
- Create: `frontend/e2e/auth/first-run.spec.ts`
- Create: `frontend/e2e/auth/login.spec.ts`

- [ ] **Step 1: Write `authStore`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: { id: string; email: string; displayName: string; globalRole: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'dls-auth' }
  )
)
```

- [ ] **Step 2: Write Playwright E2E — first-run setup**

```typescript
// e2e/auth/first-run.spec.ts
import { test, expect } from '@playwright/test'

test('setup screen shown on first run', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Create Administrator Account')).toBeVisible()
})

test('first admin created and redirected to home', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill('admin@dls.io')
  await page.getByLabel('Display Name').fill('Admin')
  await page.getByLabel('Password').fill('Secure123!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL('/dashboard')
})
```

- [ ] **Step 3: Write `SetupPage.tsx`** using `react-hook-form` + `zod` + shadcn/ui `Card`, `Input`, `Button`.

- [ ] **Step 4: Write Playwright E2E — login + lockout**

```typescript
// e2e/auth/lockout.spec.ts
test('account locked after 5 failed attempts', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@dls.io')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
  }
  await expect(page.getByText('account is locked')).toBeVisible()
})
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): SetupPage, LoginPage, auth store, E2E tests"
```

---

## Phase 2 — Cluster Management

**Goal:** KafkaCluster + SchemaRegistryConfig aggregates, DlqConfig aggregate, connectivity validation, credential encryption, CRUD APIs + UI.

**EVALUATION.md coverage:** CLUSTER-001 → CLUSTER-006, DLQCFG-001 → DLQCFG-005

---

### Task 2.1 — KafkaCluster domain aggregate

**Files:**
- Create: `backend/src/main/java/it/dls/domain/cluster/KafkaCluster.java`
- Create: `backend/src/main/java/it/dls/domain/cluster/KafkaSecurityConfig.java`
- Create: `backend/src/main/java/it/dls/domain/cluster/KafkaSecurityProtocol.java`
- Create: `backend/src/main/java/it/dls/domain/cluster/SchemaRegistryConfig.java`
- Create: `backend/src/main/java/it/dls/domain/cluster/KafkaClusterRepository.java` (port)
- Create: `backend/src/test/java/it/dls/domain/cluster/KafkaClusterTest.java`

Key domain rules:
- `KafkaCluster` owns one `SchemaRegistryConfig`
- Credentials stored as ciphertext — cluster never holds plaintext after construction
- `KafkaSecurityProtocol`: `PLAINTEXT`, `SASL_PLAIN`, `SASL_SCRAM_SHA_256`, `SASL_SCRAM_SHA_512`, `SSL`

- [ ] **Step 1: Write `KafkaSecurityProtocol` enum**

```java
public enum KafkaSecurityProtocol {
    PLAINTEXT, SASL_PLAIN, SASL_SCRAM_SHA_256, SASL_SCRAM_SHA_512, SSL
}
```

- [ ] **Step 2: Write `KafkaSecurityConfig` value object**

```java
public record KafkaSecurityConfig(
    KafkaSecurityProtocol protocol,
    String encryptedUsername,   // null for PLAINTEXT/SSL
    String encryptedPassword,   // null for PLAINTEXT
    String encryptedKeystorePem // null unless SSL
) {}
```

- [ ] **Step 3: Write failing test**

```java
@Test
void clusterRequiresBootstrapServers() {
    assertThatThrownBy(() -> KafkaCluster.create(null, "prod",
                        KafkaSecurityConfig.plaintext(), null))
        .isInstanceOf(IllegalArgumentException.class);
}
```

- [ ] **Step 4: Implement `KafkaCluster`**

```java
public class KafkaCluster {
    private final UUID id;
    private String name;
    private String bootstrapServers;
    private KafkaSecurityConfig securityConfig;
    private SchemaRegistryConfig schemaRegistry;

    public static KafkaCluster create(String bootstrapServers, String name,
                                       KafkaSecurityConfig security,
                                       SchemaRegistryConfig schemaRegistry) {
        if (bootstrapServers == null || bootstrapServers.isBlank())
            throw new IllegalArgumentException("bootstrapServers required");
        var c = new KafkaCluster();
        c.id = UUID.randomUUID();
        c.name = name;
        c.bootstrapServers = bootstrapServers;
        c.securityConfig = security;
        c.schemaRegistry = schemaRegistry;
        return c;
    }
    // getters...
}
```

- [ ] **Step 5: Run tests + commit**

```bash
./gradlew test --tests "it.dls.domain.cluster.*"
git commit -am "feat(domain): KafkaCluster aggregate with security config"
```

---

### Task 2.2 — EncryptionPort + AES-256-GCM adapter

**Files:**
- Create: `backend/src/main/java/it/dls/domain/shared/EncryptionPort.java`
- Create: `backend/src/main/java/it/dls/infrastructure/security/AesGcmEncryptionAdapter.java`
- Create: `backend/src/test/java/it/dls/infrastructure/security/AesGcmEncryptionAdapterTest.java`

- [ ] **Step 1: Write port**

```java
public interface EncryptionPort {
    String encrypt(String plaintext);
    String decrypt(String ciphertext);
}
```

- [ ] **Step 2: Write test**

```java
class AesGcmEncryptionAdapterTest {
    private final AesGcmEncryptionAdapter enc =
        new AesGcmEncryptionAdapter("0123456789abcdef0123456789abcdef");

    @Test
    void encryptDecryptRoundTrip() {
        var cipher = enc.encrypt("super-secret");
        assertThat(enc.decrypt(cipher)).isEqualTo("super-secret");
    }

    @Test
    void differentCiphertextEachTime() {
        assertThat(enc.encrypt("x")).isNotEqualTo(enc.encrypt("x"));
    }
}
```

- [ ] **Step 3: Implement**

```java
@ApplicationScoped
public class AesGcmEncryptionAdapter implements EncryptionPort {

    private final SecretKeySpec keySpec;

    @Inject
    public AesGcmEncryptionAdapter(@ConfigProperty(name = "dls.encryption.key") String key) {
        byte[] keyBytes = key.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) throw new IllegalArgumentException(
            "dls.encryption.key must be at least 32 bytes");
        this.keySpec = new SecretKeySpec(Arrays.copyOf(keyBytes, 32), "AES");
    }

    @Override
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) { throw new RuntimeException("Encryption failed", e); }
    }

    @Override
    public String decrypt(String ciphertext) {
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertext);
            byte[] iv = Arrays.copyOfRange(combined, 0, 12);
            byte[] data = Arrays.copyOfRange(combined, 12, combined.length);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(data), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new RuntimeException("Decryption failed", e); }
    }
}
```

- [ ] **Step 4: Run tests + commit**

```bash
./gradlew test --tests "it.dls.infrastructure.security.*"
git commit -am "feat(security): AES-256-GCM encryption adapter for credentials at rest"
```

---

### Task 2.3 — Connectivity validation port + Kafka adapter

**Files:**
- Create: `backend/src/main/java/it/dls/application/cluster/ConnectivityValidationPort.java`
- Create: `backend/src/main/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapter.java`
- Create: `backend/src/test/java/it/dls/infrastructure/kafka/KafkaConnectivityAdapterIT.java`

- [ ] **Step 1: Write port**

```java
public interface ConnectivityValidationPort {
    ConnectivityResult testKafka(String bootstrapServers, KafkaSecurityConfig security);
    ConnectivityResult testSchemaRegistry(String url, SchemaRegistryAuthConfig auth);
}

public record ConnectivityResult(boolean success, String errorMessage) {
    public static ConnectivityResult ok() { return new ConnectivityResult(true, null); }
    public static ConnectivityResult fail(String msg) { return new ConnectivityResult(false, msg); }
}
```

- [ ] **Step 2: Integration test (uses Dev Services Kafka)**

```java
@QuarkusTest
class KafkaConnectivityAdapterIT {

    @Inject ConnectivityValidationPort connectivity;
    @Inject @ConfigProperty(name = "kafka.bootstrap.servers") String bootstrapServers;

    @Test
    void testKafkaConnectionWithDevServices() {
        var result = connectivity.testKafka(bootstrapServers, KafkaSecurityConfig.plaintext());
        assertThat(result.success()).isTrue();
    }

    @Test
    void testUnreachableKafkaReturnsFailure() {
        var result = connectivity.testKafka("localhost:9999", KafkaSecurityConfig.plaintext());
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).isNotBlank();
    }
}
```

- [ ] **Step 3: Implement adapter using `AdminClient`**

```java
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

    // buildKafkaProperties: maps KafkaSecurityProtocol → Kafka client props
    // SASL_PLAIN: security.protocol=SASL_SSL, sasl.mechanism=PLAIN, sasl.jaas.config=...
    // SASL_SCRAM_*: sasl.mechanism=SCRAM-SHA-256/512
    // SSL: ssl.keystore.* from PEM
}
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(kafka): connectivity validation adapter with 5s timeout"
```

---

### Task 2.4 — DlqConfig domain aggregate

**Files:**
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/DlqConfig.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/FetchConfig.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/DownloadMode.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/RetentionPolicy.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/UserAssignment.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/DlqRole.java`
- Create: `backend/src/main/java/it/dls/domain/dlqconfig/DlqConfigRepository.java` (port)
- Create: `backend/src/test/java/it/dls/domain/dlqconfig/DlqConfigTest.java`

Key rule: if `FetchConfig.mode` is `SCHEDULED` or `BOTH`, `cronExpression` must not be null.

- [ ] **Step 1: Failing test**

```java
@Test
void scheduledModeRequiresCronExpression() {
    assertThatThrownBy(() -> FetchConfig.scheduled(null, 500))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("cronExpression");
}

@Test
void assignUserWithRole() {
    var config = DlqConfig.create(clusterId, "orders-dlq", "Orders DLQ",
                                   FetchConfig.onDemand(500), RetentionPolicy.maxDays(30), null);
    config.assignUser(userId, DlqRole.OPERATOR);
    assertThat(config.getUserAssignments()).hasSize(1);
    assertThat(config.getUserAssignments().get(0).role()).isEqualTo(DlqRole.OPERATOR);
}
```

- [ ] **Step 2: Implement all DlqConfig value objects and aggregate**

```java
public enum DownloadMode { SCHEDULED, ON_DEMAND, BOTH }
public enum DlqRole { VIEWER, OPERATOR }

public record FetchConfig(DownloadMode mode, String cronExpression, int batchSize) {
    public static FetchConfig scheduled(String cron, int batchSize) {
        if (cron == null || cron.isBlank())
            throw new IllegalArgumentException("cronExpression required for SCHEDULED mode");
        return new FetchConfig(DownloadMode.SCHEDULED, cron, batchSize);
    }
    public static FetchConfig onDemand(int batchSize) {
        return new FetchConfig(DownloadMode.ON_DEMAND, null, batchSize);
    }
    public static FetchConfig both(String cron, int batchSize) {
        if (cron == null || cron.isBlank())
            throw new IllegalArgumentException("cronExpression required for BOTH mode");
        return new FetchConfig(DownloadMode.BOTH, cron, batchSize);
    }
}

public record RetentionPolicy(RetentionType type, int value) {
    public enum RetentionType { MAX_AGE_DAYS, MAX_COUNT }
    public static RetentionPolicy maxDays(int days) {
        return new RetentionPolicy(RetentionType.MAX_AGE_DAYS, days);
    }
    public static RetentionPolicy maxCount(int count) {
        return new RetentionPolicy(RetentionType.MAX_COUNT, count);
    }
}

public record UserAssignment(UUID userId, DlqRole role) {}
```

- [ ] **Step 3: Run tests + commit**

```bash
./gradlew test --tests "it.dls.domain.dlqconfig.*"
git commit -am "feat(domain): DlqConfig aggregate with FetchConfig, RetentionPolicy, UserAssignment"
```

---

### Task 2.5 — Flyway V3 + Cluster/DlqConfig persistence

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__cluster_dlqconfig.sql`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterEntity.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/DlqConfigEntity.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/KafkaClusterRepositoryAdapter.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/DlqConfigRepositoryAdapter.java`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE kafka_clusters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    bootstrap_servers   TEXT NOT NULL,
    security_protocol   VARCHAR(30) NOT NULL,
    encrypted_username  TEXT,
    encrypted_password  TEXT,
    encrypted_keystore  TEXT,
    sr_url              TEXT NOT NULL,
    sr_encrypted_user   TEXT,
    sr_encrypted_pass   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dlq_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id          UUID NOT NULL REFERENCES kafka_clusters(id) ON DELETE CASCADE,
    topic_name          VARCHAR(500) NOT NULL,
    display_name        VARCHAR(255) NOT NULL,
    download_mode       VARCHAR(20) NOT NULL CHECK (download_mode IN ('SCHEDULED','ON_DEMAND','BOTH')),
    cron_expression     VARCHAR(100),
    batch_size          INT NOT NULL DEFAULT 500,
    retention_type      VARCHAR(20) NOT NULL CHECK (retention_type IN ('MAX_AGE_DAYS','MAX_COUNT')),
    retention_value     INT NOT NULL,
    default_replay_topic VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cluster_id, topic_name)
);

CREATE TABLE dlq_user_assignments (
    dlq_config_id UUID NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('VIEWER','OPERATOR')),
    PRIMARY KEY (dlq_config_id, user_id)
);

CREATE TABLE dlq_partition_offsets (
    dlq_config_id UUID    NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    partition     INT     NOT NULL,
    last_offset   BIGINT  NOT NULL DEFAULT -1,
    status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (dlq_config_id, partition)
);
```

- [ ] **Step 2: Implement `ManageClusterUseCase`**

```java
@ApplicationScoped
public class ManageClusterUseCase {

    @Inject KafkaClusterRepository clusterRepo;
    @Inject ConnectivityValidationPort connectivity;
    @Inject EncryptionPort encryption;

    @Transactional
    public KafkaCluster registerCluster(RegisterClusterCommand cmd) {
        var security = buildSecurityConfig(cmd, encryption);
        var srConfig = new SchemaRegistryConfig(cmd.srUrl(),
            cmd.srUsername() != null ? encryption.encrypt(cmd.srUsername()) : null,
            cmd.srPassword() != null ? encryption.encrypt(cmd.srPassword()) : null);

        var kafkaResult = connectivity.testKafka(cmd.bootstrapServers(), security);
        if (!kafkaResult.success())
            throw new ConnectivityValidationException("Kafka: " + kafkaResult.errorMessage());

        var srResult = connectivity.testSchemaRegistry(cmd.srUrl(), srConfig.authConfig());
        if (!srResult.success())
            throw new ConnectivityValidationException("Schema Registry: " + srResult.errorMessage());

        var cluster = KafkaCluster.create(cmd.bootstrapServers(), cmd.name(), security, srConfig);
        clusterRepo.save(cluster);
        return cluster;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(cluster): V3 migration, repositories, ManageClusterUseCase with connectivity validation"
```

---

### Task 2.6 — Cluster + DlqConfig REST API + UI

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/api/cluster/ClusterResource.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/cluster/DlqConfigResource.java`
- Create: `frontend/src/pages/clusters/ClusterListPage.tsx`
- Create: `frontend/src/pages/clusters/CreateClusterPage.tsx`
- Create: `frontend/src/pages/dlqconfig/CreateDlqConfigPage.tsx`
- Create: `frontend/e2e/cluster/create-cluster.spec.ts`

Key endpoints:
```
GET    /api/clusters                  — list clusters (ADMIN)
POST   /api/clusters                  — create cluster (ADMIN, validates connectivity)
DELETE /api/clusters/{id}             — delete cluster (ADMIN)
GET    /api/clusters/{id}/dlq-configs — list DLQ configs for cluster
POST   /api/clusters/{id}/dlq-configs — create DLQ config (ADMIN)
PUT    /api/dlq-configs/{id}/users    — assign user to DLQ config (ADMIN)
```

- [ ] **Step 1: Write `ClusterResource`** with `@RolesAllowed("ADMIN")` on mutating endpoints.

- [ ] **Step 2: Write Playwright test**

```typescript
// e2e/cluster/create-cluster.spec.ts
test('create cluster with unreachable SR shows blocking error', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/clusters/new')
  await page.getByLabel('Bootstrap Servers').fill('localhost:9092')
  await page.getByLabel('Schema Registry URL').fill('http://unreachable:8081')
  await page.getByRole('button', { name: 'Save Cluster' }).click()
  await expect(page.getByText('Schema Registry')).toBeVisible()
  await expect(page.getByText('unreachable')).toBeVisible()
})
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(api+ui): Cluster and DlqConfig CRUD with connectivity validation and E2E tests"
```

---

## Phase 3 — Message Ingestion

**Goal:** Kafka consumer (assign+seek, no broker offset commit), PartitionOffset management, Partition Reconciliation, Scheduled Fetch, On-Demand Fetch, Schema decoding (Avro/Protobuf/JSON Schema), SSE fetch events.

**EVALUATION.md coverage:** FETCH-001 → FETCH-012

---

### Task 3.1 — KafkaConsumerPort + PartitionOffset management

**Files:**
- Create: `backend/src/main/java/it/dls/domain/shared/KafkaConsumerPort.java`
- Create: `backend/src/main/java/it/dls/domain/shared/SchemaRegistryPort.java`
- Create: `backend/src/main/java/it/dls/application/fetch/FetchMessagesUseCase.java`
- Create: `backend/src/main/java/it/dls/application/fetch/PartitionReconciliationService.java`
- Create: `backend/src/test/java/it/dls/application/fetch/FetchMessagesUseCaseTest.java`

- [ ] **Step 1: Write ports**

```java
public interface KafkaConsumerPort {
    List<RawKafkaMessage> fetch(String bootstrapServers, KafkaSecurityConfig security,
                                String topicName, List<PartitionOffsetRequest> offsets,
                                int maxMessages);
    List<Integer> getPartitions(String bootstrapServers, KafkaSecurityConfig security,
                                String topicName);
    Map<Integer, Long> getEarliestOffsets(String bootstrapServers, KafkaSecurityConfig security,
                                          String topicName, List<Integer> partitions);
}

public interface SchemaRegistryPort {
    DecodedPayload decode(byte[] rawPayload, String schemaRegistryUrl,
                          SchemaRegistryAuthConfig auth);
    ValidationResult validate(JsonNode payload, int schemaId,
                              String schemaRegistryUrl, SchemaRegistryAuthConfig auth);
}

public record RawKafkaMessage(
    int partition, long offset, Instant timestamp,
    byte[] key, byte[] value, Map<String, String> headers
) {}

public record PartitionOffsetRequest(int partition, long fromOffset) {}
```

- [ ] **Step 2: Write `PartitionReconciliationService`**

```java
public class PartitionReconciliationService {

    public List<PartitionOffsetRequest> reconcile(
            List<PartitionOffset> stored, List<Integer> brokerPartitions,
            List<Integer> gapPartitions) {

        var storedMap = stored.stream()
            .collect(Collectors.toMap(PartitionOffset::partition, po -> po));

        var requests = new ArrayList<PartitionOffsetRequest>();
        for (int p : brokerPartitions) {
            if (!storedMap.containsKey(p)) {
                requests.add(new PartitionOffsetRequest(p, -1L)); // earliest
            } else if (gapPartitions.contains(p)) {
                requests.add(new PartitionOffsetRequest(p, -1L)); // gap: restart earliest
            } else {
                long next = storedMap.get(p).lastOffset() + 1;
                requests.add(new PartitionOffsetRequest(p, next));
            }
        }
        return requests;
    }
}
```

- [ ] **Step 3: Write failing unit test for `FetchMessagesUseCase`**

```java
class FetchMessagesUseCaseTest {

    KafkaConsumerPort kafkaConsumer = mock(KafkaConsumerPort.class);
    SchemaRegistryPort schemaRegistry = mock(SchemaRegistryPort.class);
    DlqConfigRepository configRepo = mock(DlqConfigRepository.class);
    MessageRepository messageRepo = mock(MessageRepository.class);
    NotificationPort notifier = mock(NotificationPort.class);

    FetchMessagesUseCase useCase = new FetchMessagesUseCase(
        kafkaConsumer, schemaRegistry, configRepo, messageRepo, notifier);

    @Test
    void newPartitionStartsFromEarliest() {
        var config = buildDlqConfig(DownloadMode.ON_DEMAND, 100);
        when(configRepo.findById(config.getId())).thenReturn(Optional.of(config));
        when(kafkaConsumer.getPartitions(any(), any(), any())).thenReturn(List.of(0, 1));
        // partition 1 is new (not in stored offsets)
        when(kafkaConsumer.getEarliestOffsets(any(), any(), any(), any()))
            .thenReturn(Map.of(0, 0L, 1, 0L));
        when(kafkaConsumer.fetch(any(), any(), any(), any(), anyInt()))
            .thenReturn(List.of());

        useCase.fetchOnDemand(config.getId(), UUID.randomUUID());

        verify(kafkaConsumer).fetch(any(), any(), any(),
            argThat(reqs -> reqs.stream().anyMatch(r -> r.partition() == 1 && r.fromOffset() == -1L)),
            anyInt());
    }
}
```

- [ ] **Step 4: Implement `FetchMessagesUseCase`** (scheduled + on-demand paths, gap detection, partition reconciliation, message persistence, SSE emit).

Core logic:

```java
@ApplicationScoped
public class FetchMessagesUseCase {

    // ... injected ports

    @Transactional
    public FetchResult fetchOnDemand(UUID dlqConfigId, UUID requestedBy) {
        var config = configRepo.findById(dlqConfigId)
            .orElseThrow(() -> new NotFoundException("DlqConfig not found: " + dlqConfigId));

        if (fetchLockService.isLocked(dlqConfigId)) {
            throw new FetchAlreadyInProgressException(dlqConfigId);
        }

        return doFetch(config);
    }

    private FetchResult doFetch(DlqConfig config) {
        fetchLockService.lock(config.getId());
        try {
            var cluster = clusterRepo.findById(config.getClusterId()).orElseThrow();
            var security = decryptSecurity(cluster.getSecurityConfig());

            // Partition reconciliation
            var brokerPartitions = kafkaConsumer.getPartitions(
                cluster.getBootstrapServers(), security, config.getTopicName());
            var stored = config.getPartitionOffsets();
            var earliest = kafkaConsumer.getEarliestOffsets(
                cluster.getBootstrapServers(), security, config.getTopicName(), brokerPartitions);

            var gapPartitions = detectGaps(stored, earliest);
            gapPartitions.forEach(p ->
                log.warnf("Gap detected on %s partition %d — restarting from earliest", config.getTopicName(), p));

            var requests = reconciliationService.reconcile(stored, brokerPartitions, gapPartitions);
            updateStoredPartitions(config, requests, brokerPartitions);

            // Fetch
            var raw = kafkaConsumer.fetch(cluster.getBootstrapServers(), security,
                                          config.getTopicName(), requests,
                                          config.getFetchConfig().batchSize());

            var messages = raw.stream().map(r -> ingest(r, config, cluster)).toList();
            messages.forEach(messageRepo::save);

            // Update committed offsets
            updateCommittedOffsets(config, raw);
            configRepo.save(config);

            // Notify via SSE
            notifier.emitFetchCompleted(config.getId(), messages.size());

            return new FetchResult(messages.size(), FetchStatus.SUCCESS);
        } catch (Exception e) {
            notifier.emitFetchFailed(config.getId(), e.getMessage());
            throw e;
        } finally {
            fetchLockService.unlock(config.getId());
        }
    }
}
```

- [ ] **Step 5: Flyway V4: messages table**

```sql
CREATE TABLE dlq_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dlq_config_id    UUID NOT NULL REFERENCES dlq_configs(id) ON DELETE CASCADE,
    partition        INT NOT NULL,
    kafka_offset     BIGINT NOT NULL,
    kafka_timestamp  TIMESTAMPTZ NOT NULL,
    message_key      BYTEA,
    raw_payload      BYTEA NOT NULL,
    decoded_payload  JSONB,
    schema_id        INT,
    headers          JSONB NOT NULL DEFAULT '{}',
    status           VARCHAR(20) NOT NULL DEFAULT 'NEW'
                         CHECK (status IN ('NEW','UNDER_REVIEW','REPLAYED','DISCARDED','REPLAY_FAILED')),
    schema_decode_failed BOOLEAN NOT NULL DEFAULT FALSE,
    ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dlq_config_id, partition, kafka_offset)
);

CREATE INDEX idx_dlq_messages_config_status ON dlq_messages(dlq_config_id, status);
CREATE INDEX idx_dlq_messages_timestamp     ON dlq_messages(kafka_timestamp);
CREATE INDEX idx_dlq_messages_partition     ON dlq_messages(dlq_config_id, partition);
```

- [ ] **Step 6: Integration test**

```java
@QuarkusTest
class FetchMessagesUseCaseIT {

    @Inject FetchMessagesUseCase useCase;
    @Inject KafkaProducer testProducer; // test helper

    @Test
    void fetchNewMessagesFromDlqTopic() {
        // produce 3 messages to DLQ topic via testProducer
        var config = createDlqConfig("test-dlq");
        var result = useCase.fetchOnDemand(config.getId(), adminUserId);
        assertThat(result.count()).isEqualTo(3);
    }

    @Test
    void onDemandBlockedWhenScheduledRunning() {
        var config = createDlqConfig("test-dlq-2");
        // simulate lock held
        fetchLockService.lock(config.getId());
        assertThatThrownBy(() -> useCase.fetchOnDemand(config.getId(), adminUserId))
            .isInstanceOf(FetchAlreadyInProgressException.class);
    }
}
```

- [ ] **Step 7: Scheduled Fetch via Quarkus Scheduler**

```java
@ApplicationScoped
public class ScheduledFetchJob {

    @Inject DlqConfigRepository configRepo;
    @Inject FetchMessagesUseCase fetchUseCase;

    @Scheduled(every = "1m")
    void runScheduledFetches() {
        configRepo.findAllWithScheduledFetch()
            .stream()
            .filter(c -> c.getFetchConfig().mode() != DownloadMode.ON_DEMAND)
            .forEach(c -> {
                if (cronMatches(c.getFetchConfig().cronExpression())) {
                    fetchUseCase.fetchScheduled(c.getId());
                }
            });
    }
}
```

- [ ] **Step 8: Commit**

```bash
git commit -am "feat(ingestion): FetchMessagesUseCase — partition reconciliation, gap detection, scheduled/on-demand, SSE"
```

---

### Task 3.2 — Schema decoding (Avro / Protobuf / JSON Schema)

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapter.java`
- Create: `backend/src/test/java/it/dls/infrastructure/schemaregistry/ConfluentSchemaRegistryAdapterIT.java`

- [ ] **Step 1: Implement Confluent adapter**

```java
@ApplicationScoped
public class ConfluentSchemaRegistryAdapter implements SchemaRegistryPort {

    @Override
    public DecodedPayload decode(byte[] rawPayload, String url, SchemaRegistryAuthConfig auth) {
        if (rawPayload == null || rawPayload.length < 5 || rawPayload[0] != 0x00) {
            return DecodedPayload.raw(); // not Confluent wire format
        }

        int schemaId = ByteBuffer.wrap(rawPayload, 1, 4).getInt();
        try {
            var client = buildClient(url, auth);
            var schema = client.getSchemaById(schemaId);
            return switch (schema.schemaType()) {
                case "AVRO"       -> decodeAvro(rawPayload, schema, schemaId);
                case "PROTOBUF"   -> decodeProtobuf(rawPayload, schema, schemaId);
                case "JSON"       -> decodeJsonSchema(rawPayload, schema, schemaId);
                default -> DecodedPayload.raw();
            };
        } catch (Exception e) {
            log.warnf("Schema decode failed for schemaId=%d: %s", schemaId, e.getMessage());
            return DecodedPayload.failed(schemaId);
        }
    }

    private DecodedPayload decodeAvro(byte[] raw, ParsedSchema schema, int schemaId) {
        var avroSchema = (org.apache.avro.Schema) schema.rawSchema();
        var reader = new GenericDatumReader<GenericRecord>(avroSchema);
        var decoder = DecoderFactory.get().binaryDecoder(raw, 5, raw.length - 5, null);
        var record = reader.read(null, decoder);
        return DecodedPayload.decoded(
            new ObjectMapper().readTree(record.toString()), schemaId, "AVRO");
    }
    // similar for Protobuf and JSON Schema
}
```

- [ ] **Step 2: Integration test using Testcontainers + real Schema Registry**

```java
@QuarkusTest
@TestProfile(SchemaRegistryTestProfile.class)
class ConfluentSchemaRegistryAdapterIT {

    @Test
    void decodeAvroMessage() {
        // register Avro schema, produce message with Avro encoder, decode
        var raw = encodeAvro(testSchema, Map.of("id", "123", "amount", 99.99));
        var decoded = adapter.decode(raw, srUrl, noAuth());
        assertThat(decoded.isDecoded()).isTrue();
        assertThat(decoded.payload().get("amount").asDouble()).isEqualTo(99.99);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(schema): Confluent Schema Registry adapter — Avro/Protobuf/JSON Schema decoding"
```

---

### Task 3.3 — NotificationPort + SSE adapter

**Files:**
- Create: `backend/src/main/java/it/dls/domain/shared/NotificationPort.java`
- Create: `backend/src/main/java/it/dls/infrastructure/notification/SseNotificationAdapter.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/sse/SseResource.java`

- [ ] **Step 1: Write port**

```java
public interface NotificationPort {
    void emitFetchCompleted(UUID dlqConfigId, int newMessagesCount);
    void emitFetchFailed(UUID dlqConfigId, String errorMessage);
    void emitNoteAdded(UUID messageId, UUID dlqConfigId);
    void emitMessageStatusChanged(UUID messageId, String newStatus);
}
```

- [ ] **Step 2: Implement SSE adapter with Mutiny**

```java
@ApplicationScoped
public class SseNotificationAdapter implements NotificationPort {

    private final BroadcastProcessor<SseEvent> processor =
        BroadcastProcessor.create();

    public Multi<SseEvent> streamForUser(UUID userId, Set<UUID> accessibleDlqConfigIds) {
        return processor.toHotStream()
            .filter(event -> isVisibleTo(event, accessibleDlqConfigIds));
    }

    @Override
    public void emitFetchCompleted(UUID dlqConfigId, int count) {
        processor.onNext(SseEvent.fetchCompleted(dlqConfigId, count));
    }
    // other emit methods...
}
```

- [ ] **Step 3: Write `SseResource`**

```java
@Path("/api/events")
public class SseResource {

    @Inject SseNotificationAdapter notifications;
    @Inject SecurityIdentity identity;

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RolesAllowed({"ADMIN","USER"})
    public Multi<String> stream() {
        var userId = extractUserId(identity);
        var accessibleConfigs = resolveAccessibleConfigs(userId);
        return notifications.streamForUser(userId, accessibleConfigs)
            .map(SseEvent::toJson);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(sse): NotificationPort + SSE adapter for real-time fetch/note events"
```

---

## Phase 4 — Message Inspection

**Goal:** DlqMessage aggregate persistence, list + filters (server-side + pagination), message detail, status transitions, SSE-driven badge update in frontend.

**EVALUATION.md coverage:** MSG-001 → MSG-006

---

### Task 4.1 — MessageRepository port + Panache adapter

**Files:**
- Create: `backend/src/main/java/it/dls/domain/message/MessageRepository.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/DlqMessageEntity.java`
- Create: `backend/src/main/java/it/dls/infrastructure/persistence/MessageRepositoryAdapter.java`
- Create: `backend/src/main/java/it/dls/application/inspection/InspectMessagesUseCase.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/message/MessageResource.java`
- Create: `frontend/src/pages/messages/MessageListPage.tsx`
- Create: `frontend/src/pages/messages/MessageDetailPage.tsx`
- Create: `frontend/e2e/messages/filter-messages.spec.ts`
- Create: `frontend/e2e/messages/message-detail.spec.ts`

Key endpoints:
```
GET /api/dlq-configs/{id}/messages?status=NEW&from=&to=&partition=&offsetFrom=&offsetTo=&page=&size=
GET /api/messages/{id}
PUT /api/messages/{id}/status  — change to UNDER_REVIEW or DISCARDED
```

- [ ] **Step 1: Write `MessageRepository` port**

```java
public interface MessageRepository {
    void save(DlqMessage message);
    Optional<DlqMessage> findById(UUID id);
    MessagePage findByConfig(UUID dlqConfigId, MessageFilter filter, Pageable pageable);
    void deleteOlderThan(UUID dlqConfigId, Instant cutoff);
    void deleteExceedingCount(UUID dlqConfigId, int maxCount);
}

public record MessageFilter(
    MessageStatus status,
    Instant timestampFrom,
    Instant timestampTo,
    Integer partition,
    Long offsetFrom,
    Long offsetTo
) {}
```

- [ ] **Step 2: Implement `InspectMessagesUseCase`**

```java
@ApplicationScoped
public class InspectMessagesUseCase {

    @Inject MessageRepository messageRepo;

    public MessagePage listMessages(UUID dlqConfigId, MessageFilter filter,
                                    Pageable pageable, SecurityContext ctx) {
        assertAccess(dlqConfigId, ctx);
        return messageRepo.findByConfig(dlqConfigId, filter, pageable);
    }

    @Transactional
    public DlqMessage updateStatus(UUID messageId, MessageStatus newStatus,
                                   SecurityContext ctx) {
        var msg = messageRepo.findById(messageId).orElseThrow();
        assertAccess(msg.getDlqConfigId(), ctx);
        msg.transitionTo(newStatus);
        messageRepo.save(msg);
        notifier.emitMessageStatusChanged(messageId, newStatus.name());
        return msg;
    }
}
```

- [ ] **Step 3: Playwright — message list filters**

```typescript
test('filter by status NEW shows only new messages', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/dlq-configs/test-config-id/messages')
  await page.getByRole('combobox', { name: 'Status' }).selectOption('NEW')
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  const rows = page.getByTestId('message-row')
  for (const row of await rows.all()) {
    await expect(row.getByTestId('status-badge')).toHaveText('NEW')
  }
})
```

- [ ] **Step 4: Frontend `MessageListPage.tsx`** — uses TanStack Query for server-side pagination, shadcn/ui `Table`, `Badge` for status, filter panel with `Select` and date pickers.

- [ ] **Step 5: Frontend `MessageDetailPage.tsx`** — JSON viewer for decoded payload, raw payload hex dump, headers table, note thread (Phase 5), replay button (Phase 6 — hidden for VIEWER).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(inspection): message list with server-side filters, detail view, status transitions"
```

---

## Phase 5 — Note Thread

**Goal:** Note Thread persistence, add note API, real-time SSE broadcast to co-viewers.

**EVALUATION.md coverage:** NOTE-001 → NOTE-005

---

### Task 5.1 — Note domain + persistence

**Files:**
- Create: `backend/src/main/resources/db/migration/V5__notes.sql`
- Create: `backend/src/main/java/it/dls/domain/message/Note.java`
- Create: `backend/src/main/java/it/dls/application/inspection/AddNoteUseCase.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/message/NoteResource.java`
- Create: `frontend/src/components/NoteThread.tsx`
- Create: `frontend/e2e/notes/add-note.spec.ts`

- [ ] **Step 1: Write migration V5**

```sql
CREATE TABLE notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES dlq_messages(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    ticket_reference VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_message_id ON notes(message_id);
```

- [ ] **Step 2: Write `AddNoteUseCase`**

```java
@ApplicationScoped
public class AddNoteUseCase {

    @Inject NoteRepository noteRepo;
    @Inject MessageRepository messageRepo;
    @Inject NotificationPort notifier;

    @Transactional
    public Note addNote(UUID messageId, String content,
                        String ticketReference, UUID authorId) {
        var msg = messageRepo.findById(messageId)
            .orElseThrow(() -> new NotFoundException("Message not found"));

        if (msg.getStatus() == MessageStatus.NEW) {
            msg.transitionTo(MessageStatus.UNDER_REVIEW);
            messageRepo.save(msg);
        }

        var note = Note.create(messageId, authorId, content, ticketReference);
        noteRepo.save(note);
        notifier.emitNoteAdded(messageId, msg.getDlqConfigId());
        return note;
    }
}
```

- [ ] **Step 3: Frontend `NoteThread.tsx`** — SSE hook subscribes to `NOTE_ADDED` events for the current messageId, optimistically appends new note on submit, shows author + timestamp + ticket reference badge.

- [ ] **Step 4: Playwright test**

```typescript
test('note appears in real-time for co-viewer', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  await loginAs(page1, 'operator')
  await loginAs(page2, 'viewer')

  await page1.goto('/messages/test-message-id')
  await page2.goto('/messages/test-message-id')

  await page1.getByPlaceholder('Add a note...').fill('Investigating payment issue')
  await page1.getByRole('button', { name: 'Add Note' }).click()

  await expect(page2.getByText('Investigating payment issue')).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(notes): Note Thread with real-time SSE broadcast, JIRA ticket reference"
```

---

## Phase 6 — Replay

**Goal:** Replay wizard (multi-step), payload editing + schema validation, Replay Topic resolution, Kafka publish, Replay Audit Record, message status transitions (REPLAYED / REPLAY_FAILED), retry.

**EVALUATION.md coverage:** REPLAY-001 → REPLAY-009

---

### Task 6.1 — KafkaProducerPort + replay domain logic

**Files:**
- Create: `backend/src/main/java/it/dls/domain/shared/KafkaProducerPort.java`
- Create: `backend/src/main/java/it/dls/domain/message/ReplayAuditRecord.java`
- Create: `backend/src/main/java/it/dls/application/replay/ReplayMessageUseCase.java`
- Create: `backend/src/main/java/it/dls/application/replay/ReplayTopicResolver.java`
- Create: `backend/src/test/java/it/dls/application/replay/ReplayTopicResolverTest.java`
- Create: `backend/src/test/java/it/dls/application/replay/ReplayMessageUseCaseTest.java`

- [ ] **Step 1: Write `KafkaProducerPort`**

```java
public interface KafkaProducerPort {
    void publish(String bootstrapServers, KafkaSecurityConfig security,
                 String topic, byte[] key, byte[] payload, Map<String, String> headers);
}
```

- [ ] **Step 2: Write `ReplayTopicResolver` with tests**

```java
class ReplayTopicResolverTest {

    @Test
    void usesOverrideWhenPresent() {
        var resolver = new ReplayTopicResolver();
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithOverride("orders-fixed");
        assertThat(resolver.resolve(msg, config, null)).isEqualTo("orders-fixed");
    }

    @Test
    void fallsBackToOriginalTopicHeader() {
        var resolver = new ReplayTopicResolver();
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithNoOverride();
        assertThat(resolver.resolve(msg, config, null)).isEqualTo("orders");
    }

    @Test
    void wizardOverrideTakesPrecedenceOverConfig() {
        var resolver = new ReplayTopicResolver();
        var msg = messageWithHeader("x-original-topic", "orders");
        var config = configWithOverride("orders-fixed");
        assertThat(resolver.resolve(msg, config, "orders-wizard")).isEqualTo("orders-wizard");
    }
}
```

- [ ] **Step 3: Implement `ReplayTopicResolver`**

```java
public class ReplayTopicResolver {
    private static final String ORIGINAL_TOPIC_HEADER = "x-original-topic";

    public String resolve(DlqMessage message, DlqConfig config, String wizardOverride) {
        if (wizardOverride != null && !wizardOverride.isBlank()) return wizardOverride;
        if (config.getDefaultReplayTopic() != null) return config.getDefaultReplayTopic();
        var header = message.getHeaders().get(ORIGINAL_TOPIC_HEADER);
        if (header != null) return header;
        throw new ReplayTopicNotResolvableException(message.getId());
    }
}
```

- [ ] **Step 4: Write `ReplayMessageUseCase`**

```java
@ApplicationScoped
public class ReplayMessageUseCase {

    @Inject KafkaProducerPort producer;
    @Inject SchemaRegistryPort schemaRegistry;
    @Inject MessageRepository messageRepo;
    @Inject DlqConfigRepository configRepo;
    @Inject KafkaClusterRepository clusterRepo;
    @Inject NotificationPort notifier;
    @Inject ReplayTopicResolver topicResolver;

    @Transactional
    public ReplayResult replay(UUID messageId, String wizardTopicOverride,
                               JsonNode editedPayload, UUID replayedBy) {
        var msg = messageRepo.findById(messageId).orElseThrow();
        var config = configRepo.findById(msg.getDlqConfigId()).orElseThrow();
        var cluster = clusterRepo.findById(config.getClusterId()).orElseThrow();

        // Schema validation if payload was edited
        if (editedPayload != null && msg.getSchemaId() != null) {
            var validation = schemaRegistry.validate(editedPayload, msg.getSchemaId(),
                cluster.getSchemaRegistry().url(),
                cluster.getSchemaRegistry().authConfig());
            if (!validation.isValid())
                throw new SchemaValidationException(validation.violations());
        }

        var targetTopic = topicResolver.resolve(msg, config, wizardTopicOverride);
        var payload = editedPayload != null
            ? editedPayload.toString().getBytes(StandardCharsets.UTF_8)
            : msg.getRawPayload();

        var headers = new HashMap<>(msg.getHeaders());
        headers.put("x-dls-replayed-at", Instant.now().toString());
        headers.put("x-dls-replayed-by", replayedBy.toString());

        try {
            producer.publish(cluster.getBootstrapServers(),
                decryptSecurity(cluster.getSecurityConfig()),
                targetTopic, msg.getMessageKey(), payload, headers);

            msg.markReplayed(targetTopic, replayedBy, editedPayload != null);
            messageRepo.save(msg);
            notifier.emitMessageStatusChanged(messageId, "REPLAYED");
            return ReplayResult.success(targetTopic);
        } catch (Exception e) {
            msg.markReplayFailed(e.getMessage(), replayedBy);
            messageRepo.save(msg);
            notifier.emitMessageStatusChanged(messageId, "REPLAY_FAILED");
            return ReplayResult.failure(e.getMessage());
        }
    }
}
```

- [ ] **Step 5: Flyway V6: replay_audit_records**

```sql
CREATE TABLE replay_audit_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES dlq_messages(id) ON DELETE CASCADE,
    replayed_by     UUID NOT NULL REFERENCES users(id),
    replayed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    target_topic    VARCHAR(500) NOT NULL,
    payload_edited  BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason  TEXT,
    attempt_count   INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_replay_audit_message ON replay_audit_records(message_id);
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(replay): ReplayMessageUseCase — topic resolution, schema validation, audit record, REPLAYED/REPLAY_FAILED status"
```

---

### Task 6.2 — Replay REST API + Wizard frontend

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/api/replay/ReplayResource.java`
- Create: `frontend/src/pages/replay/ReplayWizard.tsx`
- Create: `frontend/src/pages/replay/steps/ReviewStep.tsx`
- Create: `frontend/src/pages/replay/steps/EditPayloadStep.tsx`
- Create: `frontend/src/pages/replay/steps/ConfirmStep.tsx`
- Create: `frontend/e2e/replay/replay-wizard.spec.ts`
- Create: `frontend/e2e/replay/payload-validation.spec.ts`

Endpoints:
```
POST /api/messages/{id}/replay
  body: { targetTopicOverride?: string, editedPayload?: object }

POST /api/messages/{id}/validate-payload
  body: { payload: object }
  → returns { valid: boolean, violations: string[] }
```

- [ ] **Step 1: Write `ReplayResource`**

```java
@Path("/api/messages/{id}")
@RolesAllowed({"ADMIN","OPERATOR"})
public class ReplayResource {

    @Inject ReplayMessageUseCase replayUseCase;
    @Inject SchemaRegistryPort schemaRegistry;

    @POST @Path("/replay")
    public Response replay(@PathParam("id") UUID messageId,
                           ReplayRequest req,
                           @Context SecurityContext ctx) {
        var replayedBy = extractUserId(ctx);
        var result = replayUseCase.replay(messageId, req.targetTopicOverride(),
                                          req.editedPayload(), replayedBy);
        return result.success()
            ? Response.ok(result).build()
            : Response.status(422).entity(result).build();
    }

    @POST @Path("/validate-payload")
    public ValidationResponse validatePayload(@PathParam("id") UUID messageId,
                                              ValidatePayloadRequest req) {
        var msg = messageRepo.findById(messageId).orElseThrow();
        // ... call schemaRegistry.validate
    }
}
```

- [ ] **Step 2: Write Playwright wizard test**

```typescript
test('replay wizard completes successfully', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/messages/test-message-id')
  await page.getByRole('button', { name: 'Replay' }).click()

  // Step 1 — review
  await expect(page.getByText('orders')).toBeVisible() // resolved topic
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2 — confirm
  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  // Result
  await expect(page.getByText('Replay successful')).toBeVisible()
  await expect(page.getByTestId('status-badge')).toHaveText('REPLAYED')
})

test('invalid edited payload disables confirm button', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/messages/test-message-id')
  await page.getByRole('button', { name: 'Replay' }).click()
  await page.getByRole('button', { name: 'Edit Payload' }).click()

  // Break the payload
  await page.getByTestId('payload-editor').fill('{"amount": "not-a-number"}')

  await expect(page.getByRole('button', { name: 'Confirm Replay' })).toBeDisabled()
  await expect(page.getByText('amount')).toBeVisible() // violation message
})
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(replay): Replay wizard UI with payload editing, schema validation, E2E tests"
```

---

## Phase 7 — Retention & SSE Frontend Integration

**Goal:** Retention policy job, frontend SSE hooks, badge counter, "message no longer available" handler, full integration smoke test.

**EVALUATION.md coverage:** RETENTION-001 → RETENTION-003, SSE-001 → SSE-003

---

### Task 7.1 — Retention job

**Files:**
- Create: `backend/src/main/java/it/dls/application/retention/RetentionJob.java`
- Create: `backend/src/test/java/it/dls/application/retention/RetentionJobIT.java`

- [ ] **Step 1: Write retention job**

```java
@ApplicationScoped
public class RetentionJob {

    @Inject DlqConfigRepository configRepo;
    @Inject MessageRepository messageRepo;

    @Scheduled(cron = "0 2 * * * ?") // 2am daily
    @Transactional
    void applyRetention() {
        configRepo.findAll().forEach(config -> {
            var policy = config.getRetentionPolicy();
            switch (policy.type()) {
                case MAX_AGE_DAYS -> messageRepo.deleteOlderThan(
                    config.getId(),
                    Instant.now().minus(policy.value(), ChronoUnit.DAYS));
                case MAX_COUNT -> messageRepo.deleteExceedingCount(
                    config.getId(), policy.value());
            }
        });
    }
}
```

- [ ] **Step 2: Integration test**

```java
@QuarkusTest
class RetentionJobIT {

    @Test
    @Transactional
    void deletesMessagesOlderThanPolicy() {
        var config = createDlqConfigWithRetention(RetentionPolicy.maxDays(1));
        ingestMessageWithTimestamp(config.getId(), Instant.now().minus(2, ChronoUnit.DAYS));
        ingestMessageWithTimestamp(config.getId(), Instant.now());

        retentionJob.applyRetention();

        var remaining = messageRepo.findByConfig(config.getId(), noFilter(), Pageable.unpaged());
        assertThat(remaining.total()).isEqualTo(1);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(retention): daily retention job for MAX_AGE_DAYS and MAX_COUNT policies"
```

---

### Task 7.2 — Frontend SSE hooks + badge + stale message handler

**Files:**
- Create: `frontend/src/hooks/useSSE.ts`
- Create: `frontend/src/hooks/useDlqBadge.ts`
- Modify: `frontend/src/pages/messages/MessageDetailPage.tsx`

- [ ] **Step 1: Write `useSSE` hook**

```typescript
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useSSE(onEvent: (event: MessageEvent) => void) {
  const token = useAuthStore(s => s.token)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) return
    const es = new EventSource(`/api/events?token=${token}`)
    es.onmessage = onEvent
    es.onerror = () => { es.close(); esRef.current = null }
    esRef.current = es
    return () => es.close()
  }, [token])
}
```

- [ ] **Step 2: Write `useDlqBadge` hook**

```typescript
export function useDlqBadge(dlqConfigId: string) {
  const [newCount, setNewCount] = useState(0)
  useSSE((event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'FETCH_COMPLETED' && data.dlqConfigId === dlqConfigId) {
      setNewCount(prev => prev + data.newMessagesCount)
    }
  })
  return { newCount, clearBadge: () => setNewCount(0) }
}
```

- [ ] **Step 3: Add "message no longer available" handler in `MessageDetailPage`**

```typescript
// In MessageDetailPage query
const { data, error } = useQuery({
  queryKey: ['message', messageId],
  queryFn: () => api.getMessage(messageId),
})

useSSE((event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'MESSAGE_STATUS_CHANGED' && data.messageId === messageId) {
    queryClient.invalidateQueries({ queryKey: ['message', messageId] })
  }
})

if (error?.status === 404) {
  return <Alert>Message no longer available. <Link to="..">Back to list</Link></Alert>
}
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(frontend): SSE hooks, DLQ badge counter, stale message handler"
```

---

### Task 7.3 — OpenAPI spec + TypeScript client generation

**Files:**
- Modify: `backend/build.gradle` (add quarkus-smallrye-openapi)
- Create: `frontend/orval.config.ts`

- [ ] **Step 1: Add OpenAPI extension**

```groovy
implementation 'io.quarkus:quarkus-smallrye-openapi'
```

Add to `application.properties`:
```properties
quarkus.smallrye-openapi.path=/api/openapi
mp.openapi.extensions.smallrye.info.title=Dead Letter Society API
mp.openapi.extensions.smallrye.info.version=1.0.0
```

- [ ] **Step 2: Configure orval for client generation**

```typescript
// orval.config.ts
import { defineConfig } from 'orval'
export default defineConfig({
  dls: {
    input: { target: 'http://localhost:8080/api/openapi' },
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',
      override: { mutator: { path: './src/api/client.ts', name: 'customInstance' } },
    },
  },
})
```

- [ ] **Step 3: Generate and commit**

```bash
cd frontend && npx orval
git commit -am "feat(api): OpenAPI spec + generated TypeScript client with TanStack Query hooks"
```

---

### Task 7.4 — SETUP.md

**Files:**
- Create: `SETUP.md`

- [ ] **Step 1: Write SETUP.md**

Document:
1. **Standalone mode** — Docker Compose minimal setup, `.env` configuration, first-run URL
2. **OIDC mode (Keycloak)** — realm creation, client setup, `dls-admin` role creation, env var mapping
3. **OIDC mode (Okta)** — application setup, groups-to-roles mapping, env vars
4. **Encryption key** — how to generate a secure 32-char key, standalone vs Kubernetes injection
5. **Kubernetes** — env var injection from K8s Secret + External Secrets Operator example

- [ ] **Step 2: Commit**

```bash
git commit -am "docs: SETUP.md — standalone, Keycloak, Okta, encryption key, K8s injection"
```

---

## Execution Summary

| Phase | Goal | EVALUATION.md |
|-------|------|---------------|
| 0 | Foundation scaffold | DEV-001 |
| 1 | Identity & Access | AUTH-001..015 |
| 2 | Cluster Management | CLUSTER-001..006, DLQCFG-001..005 |
| 3 | Message Ingestion | FETCH-001..012 |
| 4 | Message Inspection | MSG-001..006 |
| 5 | Note Thread | NOTE-001..005 |
| 6 | Replay | REPLAY-001..009 |
| 7 | Retention + SSE frontend + OpenAPI | RETENTION-001..003, SSE-001..003 |

Each phase produces working, tested software independently. Commit per task. All EVALUATION.md requirements covered.
