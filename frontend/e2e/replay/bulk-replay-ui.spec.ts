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

// BULK-003: button disabled when no resolvable topic
test('Replay button is disabled when no topic is available', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(2, { headers: {} }), total: 2, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)

  const rowCheckboxes = page.getByTestId('message-row').getByRole('checkbox')
  await rowCheckboxes.first().check()

  const replayBtn = page.getByRole('button', { name: /Replay \(1 selected\)/ })
  await expect(replayBtn).toBeVisible()
  await expect(replayBtn).toBeDisabled()
})

// BULK-003 (enabled case): button enabled when x-original-topic header present
test('Replay button is enabled when selected message has x-original-topic header', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configNoTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(1, { headers: { 'x-original-topic': 'orders' } }), total: 1, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)

  await page.getByTestId('message-row').getByRole('checkbox').first().check()

  const replayBtn = page.getByRole('button', { name: /Replay \(1 selected\)/ })
  await expect(replayBtn).toBeEnabled()
})
