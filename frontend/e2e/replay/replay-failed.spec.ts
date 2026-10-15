import { test, expect, type Route } from '@playwright/test'
import { loginAsOperator } from '../helpers/auth'

const MSG_ID = '00000000-0000-0000-0000-000000000042'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const baseMessage = {
  id: MSG_ID,
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 42,
  kafkaTimestamp: '2024-06-01T10:00:00.000Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: null,
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: { event: 'payment.failed', amount: 99.99 },
  rawPayload: 'eyJldmVudCI6InBheW1lbnQuZmFpbGVkIn0=',
  key: null,
  headers: { 'x-original-topic': 'orders' },
  failureInfo: { originalTopic: 'orders', originalPartition: null, originalOffset: null, originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null },
}

test.beforeEach(async ({ page }) => {
  await loginAsOperator(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route: Route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Test DLQ' } })
  )
  await page.route(`/api/messages/${MSG_ID}/notes`, (route: Route) =>
    route.fulfill({ json: [] })
  )
  await page.route('/api/events', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )
})

// REPLAY-008: Kafka publish fails → REPLAY_FAILED status + error toast with failureReason
test('failed replay transitions message to REPLAY_FAILED and shows error toast', async ({ page }) => {
  let currentStatus = 'NEW'
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: { ...baseMessage, status: currentStatus } })
  )
  await page.route(`/api/messages/${MSG_ID}/replay`, (route: Route) => {
    currentStatus = 'REPLAY_FAILED'
    route.fulfill({ json: { success: false, targetTopic: null, failureReason: 'Connection refused to kafka:9092' } })
  })

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2 — edit payload (skip editing)
  await expect(dialog.getByText('Step 2 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  await expect(page.getByText('Connection refused to kafka:9092')).toBeVisible()

  // Dialog stays open on failure — close it by clicking the backdrop overlay (top-left corner, away from toast/dialog)
  await page.locator('[aria-hidden="true"]').click({ position: { x: 10, y: 10 } })
  await expect(page.getByRole('dialog')).not.toBeVisible()

  // Reload to pick up the REPLAY_FAILED status from the mock (query cache still holds NEW after failed replay)
  await page.reload()
  await expect(page.getByTestId('status-badge')).toHaveText('REPLAY FAILED')
})

// REPLAY-008: after REPLAY_FAILED the Replay button remains visible (retry is possible)
test('replay button is visible on REPLAY_FAILED message allowing retry', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: { ...baseMessage, status: 'REPLAY_FAILED' } })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await expect(page.getByTestId('status-badge')).toHaveText('REPLAY FAILED')
  await expect(page.getByTestId('replay-button')).toBeVisible()
})

// REPLAY-008: retry (re-invoke replay on REPLAY_FAILED) → success path
test('retry after REPLAY_FAILED can succeed and transitions to REPLAYED', async ({ page }) => {
  let currentStatus = 'REPLAY_FAILED'
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: { ...baseMessage, status: currentStatus } })
  )
  await page.route(`/api/messages/${MSG_ID}/replay`, (route: Route) => {
    currentStatus = 'REPLAYED'
    route.fulfill({ json: { success: true, targetTopic: 'orders', failureReason: null } })
  })

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2 — edit payload (skip editing)
  await expect(dialog.getByText('Step 2 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  await expect(page.getByText('Replay successful')).toBeVisible()
  await expect(page.getByTestId('status-badge')).toHaveText('REPLAYED')
})
