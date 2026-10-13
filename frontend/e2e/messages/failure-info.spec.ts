import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const MESSAGE_ID = '00000000-0000-0000-0000-000000000042'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const MESSAGE = {
  id: MESSAGE_ID,
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 42,
  kafkaTimestamp: '2024-06-01T10:00:00.000Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: 7,
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: { event: 'payment.failed' },
  rawPayload: 'eyJldmVudCI6InBheW1lbnQuZmFpbGVkIn0=',
  key: null,
  headers: { 'kafka_dlt-original-topic': 'orders' },
  replayedDecodedPayload: null,
  failureInfo: {
    originalTopic: 'orders',
    originalPartition: 3,
    originalOffset: 42,
    originalTimestamp: '2023-11-14T22:13:20Z',
    exceptionMessage: 'boom',
    exceptionStacktrace: 'java.lang.IllegalStateException\n\tat Foo.bar',
  },
}

const EMPTY_FAILURE = {
  originalTopic: null, originalPartition: null, originalOffset: null,
  originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null,
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )
  await page.route(`/api/messages/${MESSAGE_ID}`, (route) => route.fulfill({ json: MESSAGE }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: null } }))
  await page.route(`/api/messages/${MESSAGE_ID}/notes*`, (route) => route.fulfill({ json: [] }))
})

// HDR-005: Failure tab shows normalized info
test('failure tab shows original topic, partition/offset and exception', async ({ page }) => {
  await page.goto(`/messages/${MESSAGE_ID}`)
  await page.getByRole('button', { name: 'Failure' }).click()
  await expect(page.getByText('orders', { exact: true })).toBeVisible()
  await expect(page.getByText('boom')).toBeVisible()
  await expect(page.getByText('java.lang.IllegalStateException')).toBeVisible()
})

// HDR-006: replay wizard resolves the topic from failureInfo, not from a hardcoded header
test('replay wizard resolves topic from failureInfo.originalTopic', async ({ page }) => {
  await page.goto(`/messages/${MESSAGE_ID}`)
  await page.getByTestId('replay-button').click()
  await expect(page.getByText('Will use:')).toContainText('orders')
})

// HDR-007: no failure info → Failure tab hidden, wizard still lets the user type a topic
test('failure tab hidden when failureInfo is empty', async ({ page }) => {
  await page.route(`/api/messages/${MESSAGE_ID}`, (route) =>
    route.fulfill({ json: { ...MESSAGE, headers: {}, failureInfo: EMPTY_FAILURE } }))
  await page.goto(`/messages/${MESSAGE_ID}`)
  await expect(page.getByRole('button', { name: /^Headers/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Failure' })).toHaveCount(0)
  await page.getByTestId('replay-button').click()
  await expect(page.getByTestId('topic-override')).toBeVisible()
  await expect(page.getByTestId('topic-override')).toBeEditable()
})
