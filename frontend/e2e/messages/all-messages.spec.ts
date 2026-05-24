import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const MSG_ID = '00000000-0000-0000-0000-000000000001'

const clusterFixture = [{ id: CLUSTER_ID, name: 'Prod', bootstrapServers: 'localhost:9092', securityProtocol: 'PLAINTEXT', hasSchemaRegistry: false }]
const configFixture = [{ id: CONFIG_ID, clusterId: CLUSTER_ID, topicName: 'orders.DLQ', displayName: 'Orders DLQ', downloadMode: 'MANUAL' }]

const baseMessage = {
  id: MSG_ID,
  dlqConfigId: CONFIG_ID,
  partition: 2,
  kafkaOffset: 99,
  kafkaTimestamp: '2024-06-01T10:00:00.000Z',
  status: 'NEW',
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: { event: 'order.failed' },
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/clusters', (route) => route.fulfill({ json: clusterFixture }))
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, (route) => route.fulfill({ json: configFixture }))
  await page.route('/api/messages*', (route) =>
    route.fulfill({ json: { messages: [baseMessage], total: 1, page: 0, size: 50 } })
  )
})

// ALLMSG-002: sidebar "All Messages" link
test('sidebar All Messages link navigates to the cross-DLQ message list', async ({ page }) => {
  await page.goto('/clusters')
  await page.getByRole('link', { name: 'All Messages' }).click()
  await expect(page).toHaveURL(/\/messages$/)
  await expect(page.getByRole('heading', { name: 'All Messages' })).toBeVisible()
})

// ALLMSG-004: Cluster and DLQ Config columns present
test('each row shows Cluster name, DLQ Config name and status badge', async ({ page }) => {
  await page.goto('/messages')
  await expect(page.getByTestId('all-message-row')).toHaveCount(1)
  const row = page.getByTestId('all-message-row').first()
  await expect(row).toContainText('Prod')
  await expect(row).toContainText('Orders DLQ')
  await expect(row.getByText('NEW')).toBeVisible()
})

// ALLMSG-003: status filter
test('status filter sends correct param to backend', async ({ page }) => {
  let requestedStatus = ''
  await page.route('/api/messages*', (route) => {
    const url = new URL(route.request().url())
    requestedStatus = url.searchParams.get('status') ?? ''
    route.fulfill({ json: { messages: [{ ...baseMessage, status: 'REPLAYED' }], total: 1, page: 0, size: 50 } })
  })
  await page.goto('/messages')
  await page.getByRole('combobox', { name: 'Status filter' }).selectOption('REPLAYED')
  await page.getByRole('button', { name: 'Apply' }).click()
  expect(requestedStatus).toBe('REPLAYED')
})

// ALLMSG-005: row links to message detail
test('each row has a View link pointing to the Message Detail page', async ({ page }) => {
  await page.goto('/messages')
  await expect(page.getByTestId('all-message-row')).toBeVisible()
  const viewLink = page.getByTestId('all-message-row').getByRole('link', { name: 'View' }).first()
  await expect(viewLink).toHaveAttribute('href', `/messages/${MSG_ID}`)
})
