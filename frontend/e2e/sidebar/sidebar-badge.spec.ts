import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_A = '00000000-0000-0000-0000-000000000099' // non-zero NEW count
const CONFIG_B = '00000000-0000-0000-0000-000000000098' // zero NEW count

const clusterFixture = [{ id: CLUSTER_ID, name: 'Prod', bootstrapServers: 'localhost:9092', securityProtocol: 'PLAINTEXT', hasSchemaRegistry: false }]
const configsFixture = [
  { id: CONFIG_A, clusterId: CLUSTER_ID, topicName: 'orders.DLQ', displayName: 'Orders DLQ', downloadMode: 'MANUAL' },
  { id: CONFIG_B, clusterId: CLUSTER_ID, topicName: 'payments.DLQ', displayName: 'Payments DLQ', downloadMode: 'MANUAL' },
]

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/clusters', (route) => route.fulfill({ json: clusterFixture }))
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, (route) => route.fulfill({ json: configsFixture }))
  await page.route('/api/events*', (route) =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }, body: '' })
  )
})

// SIDEBAR-002: badge shows count when NEW messages > 0
test('badge shows NEW message count next to DLQ Config name', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_A}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 5, page: 0, size: 0 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_B}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 0 } })
  )
  await page.goto('/clusters')
  await expect(page.getByText('Orders DLQ')).toBeVisible()
  // Badge with count 5 is visible in the sidebar
  await expect(page.getByText('5')).toBeVisible()
})

// SIDEBAR-003: muted dot (no number) when count is zero
test('muted dot shown instead of badge when DLQ Config has zero NEW messages', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_A}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 0 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_B}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 0 } })
  )
  await page.goto('/clusters')
  // Find the DLQ Config link in the sidebar nav
  const configLink = page.locator('nav').getByRole('link', { name: /Orders DLQ/ })
  await expect(configLink).toBeVisible()
  // No numeric badge inside the link (dot shows instead)
  await expect(configLink.getByText(/^\d+$/)).not.toBeVisible()
})

// SIDEBAR-004: badge refreshes after MESSAGE_STATUS_CHANGED SSE event
test('badge count updates when MESSAGE_STATUS_CHANGED SSE event is received', async ({ page }) => {
  // Replace window.EventSource with a controllable mock before page load
  await page.addInitScript(() => {
    const instances: Array<{ onmessage: ((e: MessageEvent) => void) | null }> = []
    ;(window as unknown as Record<string, unknown>).__sseInstances = instances

    class MockEventSource {
      onmessage: ((e: MessageEvent) => void) | null = null
      constructor(_url: string) { instances.push(this) }
      close() { /* noop */ }
    }
    ;(window as unknown as Record<string, unknown>).EventSource = MockEventSource
  })

  let fetchCount = 0
  await page.route(`/api/dlq-configs/${CONFIG_A}/messages*`, (route) => {
    fetchCount++
    route.fulfill({ json: { messages: [], total: fetchCount === 1 ? 7 : 3, page: 0, size: 0 } })
  })
  await page.route(`/api/dlq-configs/${CONFIG_B}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 0 } })
  )

  await page.goto('/clusters')
  await expect(page.getByText('7')).toBeVisible()

  // Simulate SSE event
  await page.evaluate((configId) => {
    const instances = (window as unknown as Record<string, unknown[]>).__sseInstances as Array<{ onmessage: ((e: MessageEvent) => void) | null }>
    for (const es of instances) {
      if (es.onmessage) {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ type: 'MESSAGE_STATUS_CHANGED', data: { messageId: 'x', dlqConfigId: configId } }),
        })
        es.onmessage(event)
      }
    }
  }, CONFIG_A)

  // Badge re-fetches and shows updated count
  await expect(page.getByText('3')).toBeVisible()
})
