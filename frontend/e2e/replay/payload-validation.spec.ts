import { test, expect, type Route } from '@playwright/test'
import { loginAsOperator } from '../helpers/auth'

const MSG_ID = '00000000-0000-0000-0000-000000000042'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const messageWithSchema = {
  id: MSG_ID,
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 42,
  kafkaTimestamp: '2024-06-01T10:00:00.000Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: 7,
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: { event: 'payment.failed', amount: 99.99 },
  rawPayload: 'eyJldmVudCI6InBheW1lbnQuZmFpbGVkIn0=',
  key: null,
  headers: { 'x-original-topic': 'orders' },
}

test.beforeEach(async ({ page }) => {
  await loginAsOperator(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route: Route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Test DLQ' } })
  )
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: messageWithSchema })
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

test('invalid edited payload shows validation error', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}/validate-payload`, (route: Route) =>
    route.fulfill({
      json: { valid: false, error: 'amount must be a number' },
    })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()

  // Step 1: go to edit
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2: corrupt the payload
  await page.getByTestId('payload-editor').fill('{"amount": "not-a-number"}')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByTestId('validation-error')).toContainText('amount must be a number')
})

test('invalid edited payload blocks confirm button', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}/validate-payload`, (route: Route) =>
    route.fulfill({
      json: { valid: false, error: 'amount must be a number' },
    })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByTestId('payload-editor').fill('{"amount": "not-a-number"}')
  await page.getByRole('button', { name: 'Next' }).click()

  // Still on edit step — cannot reach confirm
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm Replay' })).not.toBeVisible()
})

test('valid edited payload proceeds to confirm', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}/validate-payload`, (route: Route) =>
    route.fulfill({ json: { valid: true, error: null } })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByTestId('replay-button').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByTestId('payload-editor').fill('{"amount": 50}')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('Edited by user')).toBeVisible()
})
