import { test, expect } from '@playwright/test'

test('app loads with correct title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Dead Letter Society/)
  await expect(page.getByText('Dead Letter Society')).toBeVisible()
})

test('redirects root to dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/dashboard')
})
