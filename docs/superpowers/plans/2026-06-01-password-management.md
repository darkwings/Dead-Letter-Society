# Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable password confirm at creation, self-service password change, and admin password reset — all gated on OIDC being inactive.

**Architecture:** Constructor-injected `ChangePasswordUseCase` wired via `IdentityUseCaseProducer`; two new PATCH endpoints in `AuthResource`; `SetupStatusResponse` gains `oidcEnabled`; `UserResponse` gains `authProvider`; frontend guards all password UI on `!oidcEnabled` from a shared `useSetupStatus` hook.

**Tech Stack:** Quarkus 3.x / JAX-RS / Panache (backend) · React + Vite + TanStack Query + react-hook-form + Zod (frontend) · JUnit 5 + AssertJ + Mockito (backend unit) · Vitest + Testing Library (frontend unit) · RestAssured (backend IT)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/main/java/it/dls/domain/user/User.java` | Modify | Add `changePassword(newHash)` |
| `backend/src/main/java/it/dls/application/identity/ChangePasswordUseCase.java` | Create | `changeSelf` + `adminReset` logic |
| `backend/src/main/java/it/dls/infrastructure/api/auth/IdentityUseCaseProducer.java` | Modify | Produce `ChangePasswordUseCase` |
| `backend/src/main/java/it/dls/infrastructure/api/auth/SetupStatusResponse.java` | Modify | Add `oidcEnabled` field |
| `backend/src/main/java/it/dls/infrastructure/api/auth/SetupResource.java` | Modify | Inject OIDC config flag |
| `backend/src/main/java/it/dls/infrastructure/api/auth/UserResponse.java` | Modify | Add `authProvider` field |
| `backend/src/main/java/it/dls/infrastructure/api/auth/ChangeMyPasswordRequest.java` | Create | Request record for self-change |
| `backend/src/main/java/it/dls/infrastructure/api/auth/ResetUserPasswordRequest.java` | Create | Request record for admin reset |
| `backend/src/main/java/it/dls/infrastructure/api/auth/AuthResource.java` | Modify | Two new PATCH endpoints |
| `backend/src/test/java/it/dls/domain/user/UserTest.java` | Modify | Tests for `changePassword` |
| `backend/src/test/java/it/dls/application/identity/ChangePasswordUseCaseTest.java` | Create | Unit tests for use case |
| `backend/src/test/java/it/dls/infrastructure/api/AuthResourceIT.java` | Modify | IT for new endpoints |
| `frontend/src/hooks/useSetupStatus.ts` | Create | Shared TanStack Query hook |
| `frontend/src/pages/admin/UsersPage.tsx` | Modify | Confirm password + reset modal |
| `frontend/src/pages/admin/UsersPage.test.tsx` | Modify | Tests for new UI |
| `frontend/src/pages/ProfilePage.tsx` | Create | Self-service password change |
| `frontend/src/App.tsx` | Modify | `/profile` route |
| `frontend/src/components/TopBar.tsx` | Modify | Profile link |

---

### Task 1: Domain — `User.changePassword()`

**Files:**
- Modify: `backend/src/main/java/it/dls/domain/user/User.java`
- Modify: `backend/src/test/java/it/dls/domain/user/UserTest.java`

- [ ] **Step 1: Write failing tests**

Add to `UserTest.java` inside the existing class:

```java
@Test
void changePassword_updatesHash() {
    var user = User.createLocal("u@dls.io", "U", "oldhash");
    user.changePassword("newhash");
    assertThat(user.getPasswordHash()).isEqualTo("newhash");
}

@Test
void changePassword_rejectsBlankHash() {
    var user = User.createLocal("u@dls.io", "U", "oldhash");
    assertThatThrownBy(() -> user.changePassword(""))
        .isInstanceOf(IllegalArgumentException.class);
}

@Test
void changePassword_rejectsNullHash() {
    var user = User.createLocal("u@dls.io", "U", "oldhash");
    assertThatThrownBy(() -> user.changePassword(null))
        .isInstanceOf(IllegalArgumentException.class);
}
```

`assertThatThrownBy` is already imported via `import static org.assertj.core.api.Assertions.*;`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && ./gradlew test --tests "it.dls.domain.user.UserTest" 2>&1 | tail -20
```

Expected: compilation error — `changePassword` not yet defined.

- [ ] **Step 3: Implement `changePassword`**

Add to `User.java` after `unlock()`:

```java
public void changePassword(String newHash) {
    if (newHash == null || newHash.isBlank()) throw new IllegalArgumentException("newHash must not be blank");
    this.passwordHash = newHash;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && ./gradlew test --tests "it.dls.domain.user.UserTest" 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/it/dls/domain/user/User.java \
        backend/src/test/java/it/dls/domain/user/UserTest.java
git commit -m "feat(domain): add User.changePassword()"
```

---

### Task 2: `ChangePasswordUseCase`

**Files:**
- Create: `backend/src/main/java/it/dls/application/identity/ChangePasswordUseCase.java`
- Create: `backend/src/test/java/it/dls/application/identity/ChangePasswordUseCaseTest.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/api/auth/IdentityUseCaseProducer.java`

- [ ] **Step 1: Write failing tests**

Create `backend/src/test/java/it/dls/application/identity/ChangePasswordUseCaseTest.java`:

```java
package it.dls.application.identity;

import it.dls.domain.user.AuthProvider;
import it.dls.domain.user.User;
import it.dls.domain.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChangePasswordUseCaseTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final PasswordHashPort hasher = mock(PasswordHashPort.class);
    private final ChangePasswordUseCase useCase = new ChangePasswordUseCase(repo, hasher);

    @Test
    void changeSelf_correctCurrentPassword_updatesAndSaves() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("old", "oldhash")).thenReturn(true);
        when(hasher.hash("newpassword1")).thenReturn("newhash");

        useCase.changeSelf(user.getId(), "old", "newpassword1");

        verify(repo).save(argThat(u -> u.getPasswordHash().equals("newhash")));
    }

    @Test
    void changeSelf_wrongCurrentPassword_throwsSecurityException() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("wrong", "oldhash")).thenReturn(false);

        assertThatThrownBy(() -> useCase.changeSelf(user.getId(), "wrong", "newpassword1"))
            .isInstanceOf(SecurityException.class)
            .hasMessage("invalid-current-password");
        verify(repo, never()).save(any());
    }

    @Test
    void changeSelf_newPasswordTooShort_throwsIllegalArgument() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.verify("old", "oldhash")).thenReturn(true);

        assertThatThrownBy(() -> useCase.changeSelf(user.getId(), "old", "short"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void adminReset_localUser_updatesAndSaves() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));
        when(hasher.hash("newpassword1")).thenReturn("newhash");

        useCase.adminReset(user.getId(), "newpassword1");

        verify(repo).save(argThat(u -> u.getPasswordHash().equals("newhash")));
    }

    @Test
    void adminReset_oidcUser_throwsIllegalState() {
        var user = User.createOidc("o@dls.io", "O", "sub123");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> useCase.adminReset(user.getId(), "newpassword1"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("cannot-reset-oidc-user");
        verify(repo, never()).save(any());
    }

    @Test
    void adminReset_newPasswordTooShort_throwsIllegalArgument() {
        var user = User.createLocal("u@dls.io", "U", "oldhash");
        when(repo.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> useCase.adminReset(user.getId(), "short"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void changeSelf_userNotFound_throwsIllegalArgument() {
        UUID unknown = UUID.randomUUID();
        when(repo.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.changeSelf(unknown, "old", "newpassword1"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && ./gradlew test --tests "it.dls.application.identity.ChangePasswordUseCaseTest" 2>&1 | tail -10
```

Expected: compilation error — `ChangePasswordUseCase` not yet defined.

- [ ] **Step 3: Implement `ChangePasswordUseCase`**

Create `backend/src/main/java/it/dls/application/identity/ChangePasswordUseCase.java`:

```java
package it.dls.application.identity;

import it.dls.domain.user.AuthProvider;
import it.dls.domain.user.UserRepository;

import java.util.UUID;

public class ChangePasswordUseCase {

    private final UserRepository userRepository;
    private final PasswordHashPort passwordHash;

    public ChangePasswordUseCase(UserRepository userRepository, PasswordHashPort passwordHash) {
        this.userRepository = userRepository;
        this.passwordHash = passwordHash;
    }

    public void changeSelf(UUID userId, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 8)
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (!passwordHash.verify(currentPassword, user.getPasswordHash()))
            throw new SecurityException("invalid-current-password");
        user.changePassword(passwordHash.hash(newPassword));
        userRepository.save(user);
    }

    public void adminReset(UUID targetUserId, String newPassword) {
        if (newPassword == null || newPassword.length() < 8)
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        var user = userRepository.findById(targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + targetUserId));
        if (user.getAuthProvider() == AuthProvider.OIDC)
            throw new IllegalStateException("cannot-reset-oidc-user");
        user.changePassword(passwordHash.hash(newPassword));
        userRepository.save(user);
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && ./gradlew test --tests "it.dls.application.identity.ChangePasswordUseCaseTest" 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Wire into CDI — add to `IdentityUseCaseProducer`**

In `IdentityUseCaseProducer.java`, add:

```java
import it.dls.application.identity.ChangePasswordUseCase;
```

Add this method after `oidcLoginUseCase()`:

```java
@Produces
@ApplicationScoped
public ChangePasswordUseCase changePasswordUseCase() {
    return new ChangePasswordUseCase(userRepository, passwordHashPort);
}
```

- [ ] **Step 6: Compile check**

```bash
cd backend && ./gradlew compileJava 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/it/dls/application/identity/ChangePasswordUseCase.java \
        backend/src/main/java/it/dls/infrastructure/api/auth/IdentityUseCaseProducer.java \
        backend/src/test/java/it/dls/application/identity/ChangePasswordUseCaseTest.java
git commit -m "feat(identity): add ChangePasswordUseCase with changeSelf and adminReset"
```

---

### Task 3: Extend `SetupStatusResponse` and `UserResponse`

**Files:**
- Modify: `backend/src/main/java/it/dls/infrastructure/api/auth/SetupStatusResponse.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/api/auth/SetupResource.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/api/auth/UserResponse.java`

No TDD needed — these are pure data shape changes verified by the IT in Task 5.

- [ ] **Step 1: Extend `SetupStatusResponse`**

Replace the entire file content:

```java
package it.dls.infrastructure.api.auth;

public record SetupStatusResponse(boolean setupRequired, boolean oidcEnabled) {}
```

- [ ] **Step 2: Inject OIDC flag in `SetupResource`**

In `SetupResource.java`, add the field injection after the existing `@Inject` fields:

```java
import org.eclipse.microprofile.config.inject.ConfigProperty;
```

Add field:
```java
@ConfigProperty(name = "quarkus.oidc.enabled", defaultValue = "false")
boolean oidcEnabled;
```

Update the `status()` method:

```java
@GET
@Path("/status")
public SetupStatusResponse status() {
    return new SetupStatusResponse(!userRepository.existsAny(), oidcEnabled);
}
```

- [ ] **Step 3: Add `authProvider` to `UserResponse`**

Replace the entire file content:

```java
package it.dls.infrastructure.api.auth;

import it.dls.domain.user.User;

public record UserResponse(String id, String email, String displayName, String role, String authProvider) {

    public static UserResponse from(User u) {
        return new UserResponse(
            u.getId().toString(),
            u.getEmail(),
            u.getDisplayName(),
            u.getGlobalRole().name(),
            u.getAuthProvider().name()
        );
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd backend && ./gradlew compileJava 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/it/dls/infrastructure/api/auth/SetupStatusResponse.java \
        backend/src/main/java/it/dls/infrastructure/api/auth/SetupResource.java \
        backend/src/main/java/it/dls/infrastructure/api/auth/UserResponse.java
git commit -m "feat(api): expose oidcEnabled in setup status and authProvider in user response"
```

---

### Task 4: PATCH endpoints in `AuthResource`

**Files:**
- Create: `backend/src/main/java/it/dls/infrastructure/api/auth/ChangeMyPasswordRequest.java`
- Create: `backend/src/main/java/it/dls/infrastructure/api/auth/ResetUserPasswordRequest.java`
- Modify: `backend/src/main/java/it/dls/infrastructure/api/auth/AuthResource.java`

- [ ] **Step 1: Create request records**

Create `ChangeMyPasswordRequest.java`:

```java
package it.dls.infrastructure.api.auth;

public record ChangeMyPasswordRequest(String currentPassword, String newPassword) {}
```

Create `ResetUserPasswordRequest.java`:

```java
package it.dls.infrastructure.api.auth;

public record ResetUserPasswordRequest(String newPassword) {}
```

- [ ] **Step 2: Add `ChangePasswordUseCase` injection and two endpoints to `AuthResource`**

Add field injection after the existing `@Inject` fields in `AuthResource.java`:

```java
@Inject ChangePasswordUseCase changePassword;
```

Add the import at the top of the file:

```java
import it.dls.application.identity.ChangePasswordUseCase;
```

Add the two PATCH methods after `createUser()`:

```java
@PATCH
@Path("/users/me/password")
@RolesAllowed({"ADMIN", "USER"})
public Response changeMyPassword(ChangeMyPasswordRequest req) {
    if (req == null || req.currentPassword() == null || req.currentPassword().isBlank()
            || req.newPassword() == null || req.newPassword().isBlank()) {
        return ProblemDetail.badRequest("currentPassword and newPassword are required").toResponse();
    }
    UUID userId = UUID.fromString(jwt.getSubject());
    try {
        changePassword.changeSelf(userId, req.currentPassword(), req.newPassword());
        return Response.noContent().build();
    } catch (SecurityException e) {
        return ProblemDetail.unauthorized(e.getMessage()).toResponse();
    } catch (IllegalArgumentException e) {
        return ProblemDetail.badRequest(e.getMessage()).toResponse();
    }
}

@PATCH
@Path("/users/{id}/password")
@RolesAllowed("ADMIN")
public Response resetUserPassword(@PathParam("id") UUID targetId, ResetUserPasswordRequest req) {
    if (req == null || req.newPassword() == null || req.newPassword().isBlank()) {
        return ProblemDetail.badRequest("newPassword is required").toResponse();
    }
    try {
        changePassword.adminReset(targetId, req.newPassword());
        return Response.noContent().build();
    } catch (IllegalArgumentException e) {
        return ProblemDetail.notFound(e.getMessage()).toResponse();
    } catch (IllegalStateException e) {
        return ProblemDetail.unprocessable(e.getMessage()).toResponse();
    }
}
```

- [ ] **Step 3: Compile check**

```bash
cd backend && ./gradlew compileJava 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/it/dls/infrastructure/api/auth/ChangeMyPasswordRequest.java \
        backend/src/main/java/it/dls/infrastructure/api/auth/ResetUserPasswordRequest.java \
        backend/src/main/java/it/dls/infrastructure/api/auth/AuthResource.java
git commit -m "feat(api): add PATCH endpoints for self and admin password management"
```

---

### Task 5: Integration tests — `AuthResourceIT`

**Files:**
- Modify: `backend/src/test/java/it/dls/infrastructure/api/AuthResourceIT.java`

- [ ] **Step 1: Add four new test methods**

Add these tests to `AuthResourceIT.java` inside the class, after the existing `wrongPassword_returns401` test. These tests are self-contained: each creates its own users and cleans up.

```java
private static final String ADMIN_EMAIL   = "itadmin@dls.io";
private static final String REGULAR_EMAIL = "ituser@dls.io";
private static final String IT_PASSWORD   = "TestPass123!";

@BeforeEach
@Transactional
void cleanItUsers() {
    UserEntity.delete("email in ?1", List.of(ADMIN_EMAIL, REGULAR_EMAIL));
}

// helper — creates a user via setup or admin API and returns a JWT
private String createAdminAndLogin() {
    // Use setup endpoint if no users exist, otherwise create via admin API
    given()
        .contentType(ContentType.JSON)
        .body("""
            {"email":"%s","displayName":"IT Admin","password":"%s"}
            """.formatted(ADMIN_EMAIL, IT_PASSWORD))
        .when().post("/api/setup")
        .then()
        .statusCode(anyOf(is(201), is(409))); // 409 if already created by another test

    return given()
        .contentType(ContentType.JSON)
        .body("""
            {"email":"%s","password":"%s"}
            """.formatted(ADMIN_EMAIL, IT_PASSWORD))
        .when().post("/api/auth/login")
        .then()
        .statusCode(200)
        .extract().path("token");
}

@Test
@Order(10)
void changeSelf_correctCurrentPassword_returns204() {
    String token = createAdminAndLogin();

    given()
        .header("Authorization", "Bearer " + token)
        .contentType(ContentType.JSON)
        .body("""
            {"currentPassword":"%s","newPassword":"NewPass456!"}
            """.formatted(IT_PASSWORD))
        .when().patch("/api/auth/users/me/password")
        .then()
        .statusCode(204);
}

@Test
@Order(11)
void changeSelf_wrongCurrentPassword_returns401() {
    String token = createAdminAndLogin();

    given()
        .header("Authorization", "Bearer " + token)
        .contentType(ContentType.JSON)
        .body("""
            {"currentPassword":"wrongpassword","newPassword":"NewPass456!"}
            """)
        .when().patch("/api/auth/users/me/password")
        .then()
        .statusCode(401);
}

@Test
@Order(12)
void adminReset_asAdmin_returns204() {
    String adminToken = createAdminAndLogin();

    // create a regular user
    given()
        .header("Authorization", "Bearer " + adminToken)
        .contentType(ContentType.JSON)
        .body("""
            {"email":"%s","displayName":"IT User","password":"%s"}
            """.formatted(REGULAR_EMAIL, IT_PASSWORD))
        .when().post("/api/auth/users")
        .then()
        .statusCode(201);

    String userId = given()
        .header("Authorization", "Bearer " + adminToken)
        .when().get("/api/auth/users")
        .then()
        .statusCode(200)
        .extract()
        .jsonPath()
        .getString("find { it.email == '%s' }.id".formatted(REGULAR_EMAIL));

    given()
        .header("Authorization", "Bearer " + adminToken)
        .contentType(ContentType.JSON)
        .body("""
            {"newPassword":"ResetPass789!"}
            """)
        .when().patch("/api/auth/users/" + userId + "/password")
        .then()
        .statusCode(204);
}

@Test
@Order(13)
void adminReset_asNonAdmin_returns403() {
    String adminToken = createAdminAndLogin();

    // create regular user and get their token
    given()
        .header("Authorization", "Bearer " + adminToken)
        .contentType(ContentType.JSON)
        .body("""
            {"email":"%s","displayName":"IT User","password":"%s"}
            """.formatted(REGULAR_EMAIL, IT_PASSWORD))
        .when().post("/api/auth/users")
        .then()
        .statusCode(anyOf(is(201), is(409)));

    String userToken = given()
        .contentType(ContentType.JSON)
        .body("""
            {"email":"%s","password":"%s"}
            """.formatted(REGULAR_EMAIL, IT_PASSWORD))
        .when().post("/api/auth/login")
        .then()
        .statusCode(200)
        .extract().path("token");

    // non-admin tries to reset another user
    String adminId = given()
        .header("Authorization", "Bearer " + adminToken)
        .when().get("/api/auth/users")
        .then().extract()
        .jsonPath()
        .getString("find { it.email == '%s' }.id".formatted(ADMIN_EMAIL));

    given()
        .header("Authorization", "Bearer " + userToken)
        .contentType(ContentType.JSON)
        .body("""
            {"newPassword":"Hacked!123"}
            """)
        .when().patch("/api/auth/users/" + adminId + "/password")
        .then()
        .statusCode(403);
}
```

Add `import java.util.List;` and `import static org.hamcrest.Matchers.anyOf;` to the imports if not already present.

- [ ] **Step 2: Run full IT suite**

```bash
cd backend && ./gradlew test --tests "it.dls.infrastructure.api.AuthResourceIT" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/it/dls/infrastructure/api/AuthResourceIT.java
git commit -m "test(api): integration tests for password change and admin reset endpoints"
```

---

### Task 6: Frontend — `useSetupStatus` hook

**Files:**
- Create: `frontend/src/hooks/useSetupStatus.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/src/hooks/useSetupStatus.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface SetupStatus {
  setupRequired: boolean
  oidcEnabled: boolean
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<SetupStatus>('/api/setup/status'),
    staleTime: Infinity,
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSetupStatus.ts
git commit -m "feat(hooks): add useSetupStatus hook"
```

---

### Task 7: `UsersPage` — confirm password + reset modal

**Files:**
- Modify: `frontend/src/pages/admin/UsersPage.tsx`
- Modify: `frontend/src/pages/admin/UsersPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add these to `UsersPage.test.tsx`. First, update the mock data and default mock to include `authProvider` and setup status:

Replace the `USERS` constant and `beforeEach` mock.

Also update the existing `'shows Manage Access button per user'` test to expect 3 buttons (3 users now), and update `'Add User form creates user on submit'` to use `getByLabelText(/^password$/i)` (exact match) to avoid ambiguity with the new "Confirm Password" label.

```typescript
const USERS = [
  { id: 'u1', email: 'alice@co.com', displayName: 'Alice', role: 'ADMIN', authProvider: 'LOCAL' },
  { id: 'u2', email: 'bob@co.com',   displayName: 'Bob',   role: 'USER',  authProvider: 'LOCAL' },
  { id: 'u3', email: 'oidc@co.com',  displayName: 'Oidc',  role: 'USER',  authProvider: 'OIDC'  },
]
```

In `'shows Manage Access button per user'`:
```typescript
expect(screen.getAllByRole('button', { name: /manage access/i })).toHaveLength(3)
```

In `'Add User form creates user on submit'` replace `screen.getByLabelText(/password/i)` with `screen.getByLabelText(/^password$/i)`.

Update `beforeEach`:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/api/auth/users')        return Promise.resolve(USERS)
    if (path === '/api/clusters')          return Promise.resolve(CLUSTERS)
    if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
    if (path === '/api/setup/status')      return Promise.resolve({ setupRequired: false, oidcEnabled: false })
    return Promise.resolve(undefined)
  })
})
```

Add new tests:

```typescript
it('confirm password mismatch shows error and does not call API', async () => {
  const user = userEvent.setup()
  render(<UsersPage />, { wrapper: wrapper() })
  await screen.findByText('Alice')

  await user.click(screen.getByRole('button', { name: /add user/i }))
  await user.type(screen.getByLabelText(/email/i), 'new@co.com')
  await user.type(screen.getByLabelText(/display name/i), 'New User')
  await user.type(screen.getByLabelText(/^password$/i), 'secret123')
  await user.type(screen.getByLabelText(/confirm password/i), 'different')
  await user.click(screen.getByRole('button', { name: /create user/i }))

  expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  expect(mockApiFetch).not.toHaveBeenCalledWith('/api/auth/users', expect.objectContaining({ method: 'POST' }))
})

it('shows Reset Password button only for LOCAL users when oidcEnabled=false', async () => {
  render(<UsersPage />, { wrapper: wrapper() })
  await screen.findByText('Alice')

  const resetButtons = screen.getAllByRole('button', { name: /reset password/i })
  // 2 LOCAL users, 1 OIDC user → 2 reset buttons
  expect(resetButtons).toHaveLength(2)
})

it('hides Reset Password button when oidcEnabled=true', async () => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/api/auth/users')   return Promise.resolve(USERS)
    if (path === '/api/clusters')     return Promise.resolve(CLUSTERS)
    if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
    if (path === '/api/setup/status') return Promise.resolve({ setupRequired: false, oidcEnabled: true })
    return Promise.resolve(undefined)
  })
  render(<UsersPage />, { wrapper: wrapper() })
  await screen.findByText('Alice')

  expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument()
})

it('reset password modal submits PATCH with newPassword', async () => {
  mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/api/auth/users')   return Promise.resolve(USERS)
    if (path === '/api/clusters')     return Promise.resolve(CLUSTERS)
    if (path === '/api/clusters/cl1/dlq-configs') return Promise.resolve(DLQ_CONFIGS)
    if (path === '/api/setup/status') return Promise.resolve({ setupRequired: false, oidcEnabled: false })
    if (path === '/api/auth/users/u1/password' && init?.method === 'PATCH') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
  const user = userEvent.setup()
  render(<UsersPage />, { wrapper: wrapper() })
  await screen.findByText('Alice')

  await user.click(screen.getAllByRole('button', { name: /reset password/i })[0])
  expect(await screen.findByRole('heading', { name: /reset password/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/^new password$/i), 'NewPass123!')
  await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass123!')
  await user.click(screen.getByRole('button', { name: /^reset$/i }))

  await waitFor(() => {
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/auth/users/u1/password',
      expect.objectContaining({ method: 'PATCH' })
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npx vitest run src/pages/admin/UsersPage.test.tsx 2>&1 | tail -30
```

Expected: failures on new tests.

- [ ] **Step 3: Update `UsersPage.tsx`**

Make the following changes to `UsersPage.tsx`:

**a) Add imports at the top:**

```typescript
import { useSetupStatus } from '@/hooks/useSetupStatus'
```

**b) Update `UserResponse` interface:**

```typescript
interface UserResponse {
  id: string
  email: string
  displayName: string
  role: string
  authProvider: 'LOCAL' | 'OIDC'
}
```

**c) Update `createSchema` to include `confirmPassword`:**

```typescript
const createSchema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'At least 2 characters'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type CreateFormValues = z.infer<typeof createSchema>
```

**d) Inside `UsersPage()`, add after the existing state/queries:**

```typescript
const { data: setupStatus } = useSetupStatus()
const oidcEnabled = setupStatus?.oidcEnabled ?? false
const [resetTarget, setResetTarget] = useState<UserResponse | null>(null)
```

**e) Update form `defaultValues`:**

```typescript
defaultValues: { email: '', displayName: '', password: '', confirmPassword: '' },
```

**f) Update `createMutation.mutationFn` to omit `confirmPassword`:**

```typescript
mutationFn: (data: CreateFormValues) =>
  apiFetch<UserResponse>('/api/auth/users', {
    method: 'POST',
    body: JSON.stringify({ email: data.email, displayName: data.displayName, password: data.password }),
  }),
```

**g) Add the `confirmPassword` field to the form** (after the password field, inside the form JSX):

```tsx
{!oidcEnabled && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label htmlFor="newConfirmPassword" style={{ fontSize: 12, fontWeight: 500 }}>Confirm Password</label>
    <input id="newConfirmPassword" type="password" className={`input${errors.confirmPassword ? ' error' : ''}`} {...register('confirmPassword')} />
    {errors.confirmPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.confirmPassword.message}</span>}
  </div>
)}
```

Also wrap the `password` field (and its label) in `{!oidcEnabled && (...)}` so both are hidden when OIDC is active.

**h) Add "Reset Password" button per user row** (in the `<td style={{ textAlign: 'right' }}>` cell, alongside "Manage Access"):

```tsx
{!oidcEnabled && u.authProvider === 'LOCAL' && (
  <button
    className="btn btn-ghost btn-sm"
    onClick={() => setResetTarget(u)}
  >
    Reset Password
  </button>
)}
```

**i) Add the `ResetPasswordModal` component** (before `UsersPage`, after `AssignModal`):

```tsx
interface ResetPasswordModalProps {
  user: UserResponse
  onClose: () => void
}

const resetSchema = z.object({
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirmNewPassword: z.string(),
}).refine(d => d.newPassword === d.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
})
type ResetFormValues = z.infer<typeof resetSchema>

function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
  })

  const resetMutation = useMutation({
    mutationFn: ({ newPassword }: ResetFormValues) =>
      apiFetch(`/api/auth/users/${user.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => {
      toast.success(`Password reset for ${user.displayName}`)
      reset()
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="t-h3">Reset Password</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="t-small" style={{ marginBottom: 16 }}>{user.displayName} · {user.email}</p>
        <form onSubmit={handleSubmit((d) => resetMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="resetNewPassword" style={{ fontSize: 12, fontWeight: 500 }}>New Password</label>
            <input id="resetNewPassword" type="password" className={`input${errors.newPassword ? ' error' : ''}`} {...register('newPassword')} />
            {errors.newPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.newPassword.message}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="resetConfirmNewPassword" style={{ fontSize: 12, fontWeight: 500 }}>Confirm New Password</label>
            <input id="resetConfirmNewPassword" type="password" className={`input${errors.confirmNewPassword ? ' error' : ''}`} {...register('confirmNewPassword')} />
            {errors.confirmNewPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.confirmNewPassword.message}</span>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={resetMutation.isPending} style={{ marginTop: 4 }}>
            {resetMutation.isPending ? 'Resetting…' : 'Reset'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**j) Add `resetTarget` modal render** (alongside the existing `managingUser` modal at the bottom of `UsersPage` JSX):

```tsx
{resetTarget && (
  <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
)}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/pages/admin/UsersPage.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/UsersPage.tsx \
        frontend/src/pages/admin/UsersPage.test.tsx
git commit -m "feat(users): add confirm-password at creation and admin reset password modal"
```

---

### Task 8: `ProfilePage`

**Files:**
- Create: `frontend/src/pages/ProfilePage.tsx`

No separate test file — this page is simple enough to be covered by TypeScript type checking and manual verification.

- [ ] **Step 1: Create `ProfilePage.tsx`**

Create `frontend/src/pages/ProfilePage.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSetupStatus } from '@/hooks/useSetupStatus'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: status } = useSetupStatus()
  const oidcEnabled = status?.oidcEnabled ?? false

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const changeMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordForm) =>
      apiFetch('/api/auth/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      toast.success('Password updated')
      reset()
    },
    onError: (e: unknown) => {
      const err = e as { status?: number; message?: string }
      if (err.status === 401) {
        toast.error('Current password is incorrect')
      } else {
        toast.error('Failed to update password')
      }
    },
  })

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <h1 className="t-h1" style={{ marginBottom: 24 }}>My Profile</h1>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 className="t-h3" style={{ marginBottom: 16 }}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Display Name</p>
            <p style={{ fontSize: 13 }}>{user?.displayName}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Email</p>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{user?.email}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Role</p>
            <span className={`badge role-${user?.globalRole?.toLowerCase()}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
              {user?.globalRole}
            </span>
          </div>
        </div>
      </div>

      {!oidcEnabled && (
        <div className="card" style={{ padding: 24 }}>
          <h2 className="t-h3" style={{ marginBottom: 16 }}>Change Password</h2>
          <form onSubmit={handleSubmit((d) => changeMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="currentPassword" style={{ fontSize: 12, fontWeight: 500 }}>Current Password</label>
              <input id="currentPassword" type="password" className={`input${errors.currentPassword ? ' error' : ''}`} {...register('currentPassword')} />
              {errors.currentPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.currentPassword.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="newPassword" style={{ fontSize: 12, fontWeight: 500 }}>New Password</label>
              <input id="newPassword" type="password" className={`input${errors.newPassword ? ' error' : ''}`} {...register('newPassword')} />
              {errors.newPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.newPassword.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="confirmPassword" style={{ fontSize: 12, fontWeight: 500 }}>Confirm New Password</label>
              <input id="confirmPassword" type="password" className={`input${errors.confirmPassword ? ' error' : ''}`} {...register('confirmPassword')} />
              {errors.confirmPassword && <span style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>{errors.confirmPassword.message}</span>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={changeMutation.isPending} style={{ marginTop: 4 }}>
              {changeMutation.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProfilePage.tsx
git commit -m "feat(profile): add profile page with self-service password change"
```

---

### Task 9: Wire `ProfilePage` into routing and `TopBar`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/TopBar.tsx`

- [ ] **Step 1: Add `/profile` route to `App.tsx`**

Add the import at the top of `App.tsx`:

```typescript
import ProfilePage from '@/pages/ProfilePage'
```

Inside the `<Route element={<AuthLayout />}>` block, alongside other "accessible to all authenticated users" routes, add:

```tsx
<Route path="/profile" element={<ProfilePage />} />
```

- [ ] **Step 2: Add Profile link to `TopBar`**

In `TopBar.tsx`, replace the `<span>{user.displayName}</span>` with a `Link` to `/profile`:

```tsx
import { Link, useNavigate } from 'react-router-dom'
```

Replace:
```tsx
<span>{user.displayName}</span>
```

With:
```tsx
<Link
  to="/profile"
  style={{ textDecoration: 'none', color: 'inherit', fontSize: 12 }}
>
  {user.displayName}
</Link>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Run all frontend unit tests**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && ./gradlew test 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx \
        frontend/src/components/TopBar.tsx
git commit -m "feat(nav): add /profile route and profile link in TopBar"
```
