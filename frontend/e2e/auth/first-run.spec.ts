import { test, expect } from '@playwright/test'

test('setup screen shown when setupRequired is true', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: true } })
  )
  await page.goto('/setup')
  await expect(page.getByText('Create Administrator Account')).toBeVisible()
})

test('setup form has required fields', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: true } })
  )
  await page.goto('/setup')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Display Name')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
})

test('successful setup redirects to login', async ({ page }) => {
  let setupDone = false
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: !setupDone } })
  )
  await page.route('/api/setup', async route => {
    setupDone = true
    await route.fulfill({ status: 201, body: '' })
  })
  await page.goto('/setup')
  await page.getByLabel('Email').fill('admin@dls.io')
  await page.getByLabel('Display Name').fill('Admin')
  await page.getByLabel('Password').fill('Secure123!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL('/login')
})
