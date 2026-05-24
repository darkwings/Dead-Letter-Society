import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('dls-auth'))
  await page.route('/api/setup/status', (route) =>
    route.fulfill({ json: { setupRequired: false } })
  )
})

// AUTH-004: invalid credentials show generic error — no hint whether email or password wrong
test('invalid credentials show generic error toast', async ({ page }) => {
  await page.route('/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: {
        type: 'https://dls.io/errors/invalid_credentials',
        title: 'INVALID_CREDENTIALS',
        status: 401,
        detail: 'INVALID_CREDENTIALS',
      },
    })
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('wrong@example.io')
  await page.getByLabel('Password').fill('wrongpass')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Invalid email or password.')).toBeVisible()
})

// AUTH-005: locked account returns distinct 403 → specific locked message
test('locked account shows locked toast', async ({ page }) => {
  await page.route('/api/auth/login', (route) =>
    route.fulfill({
      status: 403,
      json: {
        type: 'https://dls.io/errors/account_locked',
        title: 'ACCOUNT_LOCKED',
        status: 403,
        detail: 'ACCOUNT_LOCKED',
      },
    })
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('locked@example.io')
  await page.getByLabel('Password').fill('anypass')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Your account is locked. Contact your administrator.')).toBeVisible()
})
