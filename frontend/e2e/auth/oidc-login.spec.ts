import { test, expect } from '@playwright/test'

// AUTH-008 (SPA side): unauthenticated access to protected route → redirect to /login.
// Backend OIDC redirect to the IdP is not testable without a real OIDC provider.
test('unauthenticated user accessing protected route is redirected to /login', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('dls-auth'))
  await page.goto('/clusters')
  await expect(page).toHaveURL(/\/login/)
})

// AUTH-009: after OIDC login the backend auto-provisions a USER-role account.
// Simulated here by injecting a JWT for a USER-role user (as the backend would do).
test('OIDC-provisioned user with USER globalRole can access app', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'dls-auth',
      JSON.stringify({
        state: {
          token: 'eyJhbGciOiJSUzI1NiJ9.oidc-provisioned-token',
          user: {
            id: '00000000-0000-0000-0000-000000000010',
            email: 'oidcuser@company.io',
            displayName: 'OIDC User',
            globalRole: 'USER',
          },
        },
        version: 0,
      })
    )
  })
  await page.route('/api/clusters', (route) => route.fulfill({ json: [] }))
  await page.route('/api/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )
  await page.goto('/messages')
  await expect(page).toHaveURL(/\/messages/)
})

// Full OIDC IdP redirect and backend auto-provisioning require a real OIDC provider
// (e.g. Keycloak Testcontainer). Not part of the SPA E2E suite.
test.skip('OIDC IdP redirect + backend auto-provisioning require a real OIDC provider', async () => {})
