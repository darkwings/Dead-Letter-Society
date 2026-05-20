import { type Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'dls-auth',
      JSON.stringify({
        state: {
          token: 'eyJhbGciOiJSUzI1NiJ9.test-admin-token',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@dls.io',
            displayName: 'Admin',
            globalRole: 'ADMIN',
          },
        },
        version: 0,
      })
    )
  })
}
