import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsOperator } from '../helpers/auth'

const summaryFixture = {
  newCount: 10, underReviewCount: 5, replayedCount: 3,
  discardedCount: 2, replayFailedCount: 1,
  computedAt: '2024-06-01T12:00:00.000Z',
}

// DASH-001: admin / → /dashboard
test('admin navigating to / is redirected to /dashboard', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/dashboard/summary', (route) => route.fulfill({ json: summaryFixture }))
  await page.route('/api/dashboard/sparkline*', (route) => route.fulfill({ json: [] }))
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})

// DASH-002: non-admin / → /clusters
test('non-admin navigating to / is redirected to /clusters', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/clusters/)
})
