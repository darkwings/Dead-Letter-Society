import { test, expect } from '@playwright/test'

test('app loads with correct title', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.goto('/')
  await expect(page).toHaveTitle(/Dead Letter Society/)
})

test('unauthenticated user redirected to login', async ({ page }) => {
  await page.route('/api/setup/status', route =>
    route.fulfill({ json: { setupRequired: false } })
  )
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
