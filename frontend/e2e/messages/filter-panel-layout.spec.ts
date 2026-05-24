import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

// MSG-007: filter controls in left side panel (~220px aside), not inline bar
test('filter controls are displayed in a left side panel', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 20 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: null } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)

  const aside = page.locator('aside')
  await expect(aside).toBeVisible()
  await expect(aside.getByText('Filters', { exact: true })).toBeVisible()
  await expect(aside.getByRole('combobox', { name: 'Status' })).toBeVisible()
  await expect(aside.getByRole('button', { name: 'Apply' })).toBeVisible()
})
