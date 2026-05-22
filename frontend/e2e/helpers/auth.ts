import { type Page } from '@playwright/test'

async function stubSidebarRoutes(page: Page) {
  // Sidebar fetches clusters on every authenticated page; tests that don't
  // care about clusters get an empty list so the Sidebar renders instantly.
  // Test-specific routes registered after loginAs* override this (LIFO).
  await page.route('/api/clusters', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: [] })
    } else {
      route.continue()
    }
  })
}

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
  await stubSidebarRoutes(page)
}

export async function loginAsOperator(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'dls-auth',
      JSON.stringify({
        state: {
          token: 'eyJhbGciOiJSUzI1NiJ9.test-operator-token',
          user: {
            id: '00000000-0000-0000-0000-000000000002',
            email: 'operator@dls.io',
            displayName: 'Operator',
            globalRole: 'USER',
          },
        },
        version: 0,
      })
    )
  })
  await stubSidebarRoutes(page)
}

export async function loginAsViewer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'dls-auth',
      JSON.stringify({
        state: {
          token: 'eyJhbGciOiJSUzI1NiJ9.test-viewer-token',
          user: {
            id: '00000000-0000-0000-0000-000000000003',
            email: 'viewer@dls.io',
            displayName: 'Viewer',
            globalRole: 'USER',
          },
        },
        version: 0,
      })
    )
  })
  await stubSidebarRoutes(page)
}
