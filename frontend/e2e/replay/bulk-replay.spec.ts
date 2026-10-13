import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const configWithTopic = { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: 'orders' }

const makeMessages = (count: number) =>
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
    headers: { 'x-original-topic': 'orders' },
    failureInfo: { originalTopic: 'orders', originalPartition: null, originalOffset: null, originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null },
  }))

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) => route.fulfill({ json: configWithTopic }))
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: makeMessages(3), total: 3, page: 0, size: 20 } })
  )
})

// BULK-004 + BULK-007: bulk replay posts IDs and shows success toast
test('bulk replay posts selected message IDs and shows success toast', async ({ page }) => {
  let sentIds: string[] = []
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages/bulk-replay`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    sentIds = body.messageIds
    await route.fulfill({ json: { succeeded: 2, failed: 0 } })
  })

  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  const rowCheckboxes = page.getByTestId('message-row').getByRole('checkbox')
  await rowCheckboxes.nth(0).check()
  await rowCheckboxes.nth(1).check()

  await page.getByRole('button', { name: 'Replay (2 selected)' }).click()

  await expect(page.getByText('2 messages replayed')).toBeVisible()
  expect(sentIds).toHaveLength(2)
})

// BULK-007: partial failure shows warning toast with counts
test('partial bulk replay failure shows warning toast with success and failure counts', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages/bulk-replay`, (route) =>
    route.fulfill({ json: { succeeded: 2, failed: 1 } })
  )

  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  // Select all 3 rows via select-all checkbox
  await page.getByRole('checkbox', { name: 'Select all' }).check()

  await page.getByRole('button', { name: 'Replay (3 selected)' }).click()

  await expect(page.getByText('2 replayed, 1 failed')).toBeVisible()
})
