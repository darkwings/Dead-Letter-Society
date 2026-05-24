import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'

const configFixture = {
  id: CONFIG_ID,
  clusterId: CLUSTER_ID,
  topicName: 'orders.dlq',
  displayName: 'Orders DLQ',
  downloadMode: 'ON_DEMAND',
  cronExpression: null,
  batchSize: 100,
  retentionType: 'MAX_AGE_DAYS',
  retentionValue: 30,
  defaultReplayTopic: 'orders.main',
  userAssignments: [],
}

const newMessage = {
  id: '00000000-0000-0000-0000-000000000001',
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 1,
  kafkaTimestamp: '2024-06-01T10:00:00Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: null,
  ingestedAt: '2024-06-01T10:01:00Z',
  decodedPayload: { orderId: 'abc123' },
  rawPayload: null,
  key: null,
  headers: {},
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: configFixture })
  )
  await page.route('/api/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )
})

// FETCH-009: clicking "Fetch now" triggers POST to fetch endpoint
test('Fetch now button triggers on-demand fetch and shows success toast', async ({ page }) => {
  let fetchCalled = false
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 20 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/fetch`, async (route) => {
    fetchCalled = true
    await route.fulfill({ json: { fetched: 5 } })
  })

  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByRole('button', { name: 'Fetch now' }).click()

  await expect(page.getByText('Fetched 5 new messages')).toBeVisible()
  expect(fetchCalled).toBe(true)
})

// FETCH-007: after fetch completes the message list refreshes to show new messages
test('message list refreshes after successful on-demand fetch', async ({ page }) => {
  let fetched = false
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({
      json: {
        messages: fetched ? [newMessage] : [],
        total: fetched ? 1 : 0,
        page: 0,
        size: 20,
      },
    })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/fetch`, async (route) => {
    fetched = true
    await route.fulfill({ json: { fetched: 1 } })
  })

  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await expect(page.getByTestId('message-row')).toHaveCount(0)

  await page.getByRole('button', { name: 'Fetch now' }).click()
  await expect(page.getByText('Fetched 1 new message')).toBeVisible()
  await expect(page.getByTestId('message-row')).toHaveCount(1)
})
