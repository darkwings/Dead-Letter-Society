# Password Management — Design Spec

**Date:** 2026-06-01  
**Scope:** Local-auth only (no-op when OIDC active)

## Problem

When OIDC is disabled, there is no way to:
- Confirm password at user creation
- Change own password (self-service)
- Reset another user's password (admin)

## Approach: Two dedicated endpoints + single use case

Two endpoints with distinct security contracts map to two clearly different operations. A single use case keeps the logic co-located and testable.

---

## Backend

### Domain — `User`

Add `changePassword(String newHash)`:
```java
public void changePassword(String newHash) {
    if (newHash == null || newHash.isBlank()) throw new IllegalArgumentException("newHash must not be blank");
    this.passwordHash = newHash;
}
```

### Use case — `ChangePasswordUseCase`

New class in `application/identity/`. Field injection via `@Inject` (consistent with newer use cases).

```java
void changeSelf(UUID userId, String currentPassword, String newPassword)
void adminReset(UUID targetUserId, String newPassword)
```

- `changeSelf`: loads user, verifies `passwordHash.verify(currentPassword, user.getPasswordHash())`, throws `SecurityException("invalid-current-password")` if wrong, then calls `user.changePassword(passwordHash.hash(newPassword))` and saves.
- `adminReset`: loads user, throws `IllegalStateException("cannot-reset-oidc-user")` if `authProvider == OIDC`, then resets and saves.
- Both validate `newPassword` length ≥ 8 chars; throw `IllegalArgumentException` if short.

`PasswordHashPort.verify(plain, hash)` already exists (`BcryptPasswordHashAdapter` implements it).

### Endpoints — additions to `AuthResource`

```
PATCH /api/auth/users/me/password
  @RolesAllowed({"ADMIN", "USER"})
  body: { currentPassword: string, newPassword: string }
  → 204 No Content on success
  → 401 if currentPassword wrong
  → 400 if newPassword < 8 chars

PATCH /api/auth/users/{id}/password
  @RolesAllowed("ADMIN")
  body: { newPassword: string }
  → 204 No Content on success
  → 404 if user not found
  → 422 if user is OIDC
  → 400 if newPassword < 8 chars
```

### OIDC flag — `SetupStatusResponse`

Add `oidcEnabled` field. `SetupResource` injects `@ConfigProperty(name = "quarkus.oidc.enabled") boolean oidcEnabled` and passes it to the response.

```java
public record SetupStatusResponse(boolean setupRequired, boolean oidcEnabled) {}
```

### `UserResponse`

Add `authProvider` field (`"LOCAL"` or `"OIDC"`):

```java
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

---

## Frontend

### OIDC guard

`GET /api/setup/status` already queried by `LoginPage`. Extend the response type everywhere it's used:
```ts
interface SetupStatus { setupRequired: boolean; oidcEnabled: boolean }
```

Create `useSetupStatus()` hook wrapping the existing TanStack Query — avoids duplicating the query key. All password UI gates on `!oidcEnabled`.

### Creation form — `UsersPage`

Add `confirmPassword` to `createSchema`:
```ts
const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
```

- `confirmPassword` field rendered below `password` field.
- Entire password + confirmPassword block hidden when `oidcEnabled`.
- `confirmPassword` never sent to the backend.

### Admin reset — `UsersPage`

- `UserResponse` interface gains `authProvider: 'LOCAL' | 'OIDC'`.
- "Reset Password" button in each user row, visible only when `!oidcEnabled && u.authProvider === 'LOCAL'`.
- Opens a modal with `newPassword` + `confirmPassword` fields (Zod min 8 + match refine).
- On submit: `PATCH /api/auth/users/{id}/password` with `{ newPassword }`.
- Success: toast "Password reset". Error: toast with message.

### Profile page — `/profile`

New page `frontend/src/pages/ProfilePage.tsx`. Route added to `App.tsx` behind `RouteGuard`.

Sections:
1. **Account info** — display name, email, role (read-only).
2. **Change password** — shown only when `!oidcEnabled`. Fields: `currentPassword`, `newPassword`, `confirmPassword`. On submit: `PATCH /api/auth/users/me/password`.

`TopBar` gets a "Profile" link (or dropdown entry) pointing to `/profile`.

---

## Error handling

| Scenario | Backend | Frontend |
|---|---|---|
| Current password wrong | 401 `invalid-current-password` | Toast "Current password is incorrect" |
| New password too short | 400 | Zod inline + toast fallback |
| Passwords don't match | Client only | Inline field error |
| User not found | 404 | Toast error |
| OIDC user reset | 422 `cannot-reset-oidc-user` | Toast error |
| Non-admin hits `/{id}/password` | 403 | Toast error |

---

## Testing

### Backend unit — `ChangePasswordUseCaseTest`

- `changeSelf` happy path → password updated
- `changeSelf` wrong current password → `SecurityException`
- `changeSelf` new password too short → `IllegalArgumentException`
- `adminReset` LOCAL user → password updated
- `adminReset` OIDC user → `IllegalStateException`

### Backend integration — `AuthResourceIT` additions

- `PATCH /me/password` correct current → 204
- `PATCH /me/password` wrong current → 401
- `PATCH /{id}/password` as admin → 204
- `PATCH /{id}/password` as non-admin → 403
- `PATCH /{id}/password` on OIDC user → 422

### Frontend — `UsersPage.test.tsx` additions

- Confirm-password mismatch shows inline error, does not call API
- Reset Password modal submits correctly
- Reset Password button hidden for OIDC users and when `oidcEnabled`

No new Playwright spec — password management is admin-internal UI with no message-flow dependency.

---

## Files to create / modify

| File | Change |
|---|---|
| `domain/user/User.java` | Add `changePassword()` |
| `application/identity/PasswordHashPort.java` | No change — `verify()` already present |
| `application/identity/ChangePasswordUseCase.java` | New |
| `infrastructure/api/auth/AuthResource.java` | Two new PATCH endpoints |
| `infrastructure/api/auth/SetupStatusResponse.java` | Add `oidcEnabled` |
| `infrastructure/api/auth/SetupResource.java` | Inject config, pass to response |
| `infrastructure/api/auth/UserResponse.java` | Add `authProvider` |
| `infrastructure/security/BcryptPasswordHashAdapter.java` | No change — `verify()` already present |
| `frontend/src/hooks/useSetupStatus.ts` | New shared hook |
| `frontend/src/pages/admin/UsersPage.tsx` | Confirm password + reset modal |
| `frontend/src/pages/ProfilePage.tsx` | New |
| `frontend/src/App.tsx` | Add `/profile` route |
| `frontend/src/components/TopBar.tsx` | Add Profile link |
