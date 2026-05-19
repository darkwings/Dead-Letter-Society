import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('dls-auth'))
})

test('login page shown when not authenticated', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.goto('/login')
  await expect(page.getByText('Dead Letter Society')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})

test('successful login stores token and redirects', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.route('/api/auth/login', route =>
    route.fulfill({
      json: {
        token: 'eyJhbGciOiJSUzI1NiJ9.test',
        user: { id: '00000000-0000-0000-0000-000000000001', email: 'admin@dls.io', displayName: 'Admin', role: 'ADMIN' }
      }
    })
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@dls.io')
  await page.getByLabel('Password').fill('Secure123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL('/dashboard')
})

test('wrong password shows error message', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.route('/api/auth/login', route =>
    route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS', message: 'INVALID_CREDENTIALS' } })
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@dls.io')
  await page.getByLabel('Password').fill('wrongpass')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()
})

test('locked account shows locked error', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.route('/api/auth/login', route =>
    route.fulfill({ status: 403, json: { code: 'ACCOUNT_LOCKED', message: 'ACCOUNT_LOCKED' } })
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('locked@dls.io')
  await page.getByLabel('Password').fill('Secure123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('account is locked')).toBeVisible()
})
