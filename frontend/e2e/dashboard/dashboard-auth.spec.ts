import { test, expect } from '@playwright/test'
import { loginAsOperator } from '../helpers/auth'

// DASH-010: non-admin navigating to /dashboard is redirected to /messages by AdminGuard
test('non-admin direct navigation to /dashboard is redirected to /messages', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/messages/)
})
