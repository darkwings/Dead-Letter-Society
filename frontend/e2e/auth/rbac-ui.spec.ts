import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsViewer } from '../helpers/auth'

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

const message = {
  id: '00000000-0000-0000-0000-000000000001',
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 1,
  kafkaTimestamp: '2024-06-01T10:00:00Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: null,
  ingestedAt: '2024-06-01T10:01:00Z',
  decodedPayload: { a: 1 },
  rawPayload: null,
  key: null,
  headers: {},
}

test.beforeEach(async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: configFixture })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [message], total: 1, page: 0, size: 20 } })
  )
  await page.route('/api/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )
})

// AUTH-012: non-ADMIN user (globalRole: USER) cannot see bulk replay or row checkboxes
test('viewer cannot see message checkboxes or bulk replay button', async ({ page }) => {
  await loginAsViewer(page)
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await expect(page.getByTestId('message-row')).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: 'Select all' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Replay \(/ })).not.toBeVisible()
})

// AUTH-012: ADMIN (globalRole: ADMIN) sees full controls
test('admin sees checkboxes and bulk replay button after selection', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await expect(page.getByRole('checkbox', { name: 'Select all' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select all' }).check()
  await expect(page.getByRole('button', { name: /Replay \(1/ })).toBeVisible()
})
