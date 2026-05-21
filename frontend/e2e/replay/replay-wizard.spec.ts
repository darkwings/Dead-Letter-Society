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
  headers: { 'x-original-topic': 'orders', 'X-Correlation-Id': 'abc-123' },
}

test.beforeEach(async ({ page }) => {
  await loginAsOperator(page)
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

test('replay wizard completes successfully', async ({ page }) => {
  let currentStatus = 'NEW'
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: { ...baseMessage, status: currentStatus } })
  )
  await page.route(`/api/messages/${MSG_ID}/replay`, (route: Route) => {
    currentStatus = 'REPLAYED'
    route.fulfill({ json: { success: true, targetTopic: 'orders', failureReason: null } })
  })

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()

  // Step 1 — review topic
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await expect(page.getByText('orders')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 3 — confirm (skipped edit since no override)
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('orders')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  await expect(page.getByText('Replay successful')).toBeVisible()
  await expect(page.getByTestId('status-badge')).toHaveText('REPLAYED')
})

test('wizard topic override is sent to backend', async ({ page }) => {
  let sentBody = ''
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page.route(`/api/messages/${MSG_ID}/replay`, async (route: Route) => {
    sentBody = route.request().postData() ?? ''
    await route.fulfill({ json: { success: true, targetTopic: 'orders-v2', failureReason: null } })
  })

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()

  await page.getByTestId('topic-override').fill('orders-v2')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  await expect(page.getByText('Replay successful')).toBeVisible()
  expect(JSON.parse(sentBody)).toMatchObject({ targetTopicOverride: 'orders-v2' })
})

test('replay failure shows error toast', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page.route(`/api/messages/${MSG_ID}/replay`, (route: Route) =>
    route.fulfill({ json: { success: false, targetTopic: null, failureReason: 'broker unavailable' } })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Confirm Replay' }).click()

  await expect(page.getByText('broker unavailable')).toBeVisible()
})

test('cancel closes the wizard', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Step 1 of 3')).not.toBeVisible()
})
