import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const configWithTopic = { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: 'orders' }
const configNoTopic = { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: null }

const makeMessages = (count: number, overrides: Record<string, unknown> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
    dlqConfigId: CONFIG_ID,
    partition: 0,
    kafkaOffset: i,
    kafkaTimestamp: new Date(Date.now() - i * 60_000).toISOString(),
    status: 'NEW',
    schemaDecodeFailed: false,
    schemaId: null,
    ingestedAt: new Date().toISOString(),
    decodedPayload: null,
    headers: {},
    ...overrides,
  }))

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

// BULK-001: admin sees checkboxes per message row
test('admin sees a checkbox for each message row', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configWithTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(3), total: 3, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  const checkboxes = page.getByRole('checkbox').filter({ hasText: '' })
  // At least 3 row checkboxes + 1 select-all header checkbox
  await expect(page.getByRole('checkbox')).toHaveCount(4)
})

// BULK-002: selecting messages shows "Replay (N selected)" button
test('selecting messages shows Replay button with count', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configWithTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(3), total: 3, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)

  // Select first 2 rows
  const rowCheckboxes = page.getByTestId('message-row').getByRole('checkbox')
  await rowCheckboxes.nth(0).check()
  await rowCheckboxes.nth(1).check()

  await expect(page.getByRole('button', { name: 'Replay (2 selected)' })).toBeVisible()
})

// BULK-003 (revised): no topic known → button still enabled, hint shown, user can type a topic
test('Replay button stays enabled and shows a hint when no replay topic can be inferred', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(2, { headers: {} }), total: 2, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByTestId('message-row').getByRole('checkbox').first().check()

  await expect(page.getByRole('button', { name: /Replay \(1 selected\)/ })).toBeEnabled()
  await expect(page.getByTestId('bulk-no-topic-hint')).toBeVisible()
})

// BULK-007: user-supplied target topic is sent with the bulk replay request
test('bulk replay sends targetTopicOverride when the user enters a topic', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(2, { headers: {} }), total: 2, page: 0, size: 20 } })
  )
  let sent = ''
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages/bulk-replay`, async (route) => {
    sent = route.request().postData() ?? ''
    await route.fulfill({ json: { succeeded: 1, failed: 0 } })
  })
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByTestId('message-row').getByRole('checkbox').first().check()
  await page.getByTestId('bulk-topic-override').fill('orders-manual')
  await expect(page.getByTestId('bulk-no-topic-hint')).toHaveCount(0)
  await page.getByRole('button', { name: /Replay \(1 selected\)/ }).click()
  await expect.poll(() => sent).not.toBe('')
  expect(JSON.parse(sent)).toMatchObject({ targetTopicOverride: 'orders-manual' })
})

// BULK-003 (enabled case): button enabled when failureInfo has an original topic
test('Replay button is enabled and no hint shown when selected message has an original topic', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(1, { headers: { 'kafka_dlt-original-topic': 'orders' }, failureInfo: { originalTopic: 'orders' } }), total: 1, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)

  await page.getByTestId('message-row').getByRole('checkbox').first().check()

  const replayBtn = page.getByRole('button', { name: /Replay \(1 selected\)/ })
  await expect(replayBtn).toBeEnabled()
})
