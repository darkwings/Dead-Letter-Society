import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const summaryFixture = {
  newCount: 10, underReviewCount: 5, replayedCount: 3,
  discardedCount: 2, replayFailedCount: 1,
  computedAt: '2024-06-01T12:00:00.000Z',
}

const sparklineFixture = [
  { date: '2024-05-26', replayed: 2, total: 10, replayRate: 20 },
  { date: '2024-05-27', replayed: 5, total: 10, replayRate: 50 },
]

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/dashboard/summary', (route) => route.fulfill({ json: summaryFixture }))
  await page.route('/api/dashboard/sparkline*', (route) => route.fulfill({ json: sparklineFixture }))
  // Override empty clusters mock for DLQ status table
  await page.route('/api/clusters', (route) =>
    route.fulfill({ json: [{ id: CLUSTER_ID, name: 'Prod', bootstrapServers: 'localhost:9092', securityProtocol: 'PLAINTEXT', hasSchemaRegistry: false }] })
  )
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, (route) =>
    route.fulfill({ json: [{ id: CONFIG_ID, clusterId: CLUSTER_ID, topicName: 'orders.DLQ', displayName: 'Orders DLQ', downloadMode: 'MANUAL' }] })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 7, page: 0, size: 0 } })
  )
})

// DASH-004: five summary cards
test('five summary cards show correct labels and counts', async ({ page }) => {
  await page.goto('/dashboard')
  for (const label of ['New', 'Under Review', 'Replayed', 'Discarded', 'Replay Failed']) {
    await expect(page.getByText(label)).toBeVisible()
  }
  await expect(page.getByText('10', { exact: true })).toBeVisible()
})

// DASH-005: computedAt caption
test('computedAt caption is visible', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText(/Last updated/i)).toBeVisible()
})

// DASH-006: sparkline chart
test('sparkline chart is rendered', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText(/Replay Rate/i)).toBeVisible()
  await expect(page.locator('svg').first()).toBeVisible()
})

// DASH-007: DLQ status table
test('DLQ status table shows config name, cluster name, and NEW count', async ({ page }) => {
  await page.goto('/dashboard')
  const dlqCard = page.locator('.card').filter({ hasText: 'DLQ Status' })
  await expect(dlqCard.getByRole('link', { name: 'Orders DLQ' })).toBeVisible()
  await expect(dlqCard.getByText('Prod')).toBeVisible()
  await expect(dlqCard.getByText('7')).toBeVisible()
})

// DASH-003: skeleton while loading
test('skeleton placeholders rendered while summary is loading', async ({ page }) => {
  let resolveSummary!: (v: unknown) => void
  await page.route('/api/dashboard/summary', (route) =>
    new Promise((resolve) => { resolveSummary = () => { route.fulfill({ json: summaryFixture }); resolve(undefined) } })
  )
  await page.goto('/dashboard')
  // Skeletons are visible before summary resolves
  const skeleton = page.locator('.card').filter({ hasNot: page.getByText('New') }).first()
  await expect(skeleton).toBeVisible()
  resolveSummary(null)
  await expect(page.getByText('New')).toBeVisible()
})
