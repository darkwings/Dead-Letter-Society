import { test, expect } from '@playwright/test'
import { loginAsOperator } from '../helpers/auth'

// DASH-010: non-admin gets 403 from dashboard API; page renders without crash
test('non-admin direct navigation to /dashboard sees 403 error gracefully', async ({ page }) => {
  await loginAsOperator(page)
  await page.route('/api/dashboard/summary', (route) =>
    route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: 'Admin only' } })
  )
  await page.route('/api/dashboard/sparkline*', (route) =>
    route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: 'Admin only' } })
  )
  // Navigate directly (bypassing HomeRedirect)
  await page.goto('/dashboard')
  // Page renders without crash
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  // No computedAt caption (data failed to load)
  await expect(page.getByText(/Last updated/i)).not.toBeVisible()
})
