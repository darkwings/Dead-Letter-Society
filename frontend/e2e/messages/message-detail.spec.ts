import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

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
  schemaId: 7,
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: { event: 'payment.failed', amount: 99.99 },
  rawPayload: 'eyJldmVudCI6InBheW1lbnQuZmFpbGVkIn0=',
  key: null,
  headers: { 'X-Correlation-Id': 'abc-123', 'content-type': 'application/avro' },
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/messages/${MSG_ID}`, (route) =>
    route.fulfill({ json: baseMessage })
  )
})

test('message detail renders metadata, payload, and headers', async ({ page }) => {
  await page.goto(`/messages/${MSG_ID}`)
  await expect(page.getByTestId('status-badge')).toHaveText('NEW')
  await expect(page.getByTestId('decoded-payload')).toBeVisible()
  await expect(page.getByTestId('raw-payload')).toBeVisible()
  await expect(page.getByText('X-Correlation-Id')).toBeVisible()
  await expect(page.getByText('abc-123')).toBeVisible()
})

test('decoded payload shows JSON', async ({ page }) => {
  await page.goto(`/messages/${MSG_ID}`)
  const payload = page.getByTestId('decoded-payload')
  await expect(payload).toContainText('payment.failed')
  await expect(payload).toContainText('99.99')
})

test('mark under review updates status', async ({ page }) => {
  // Stateful mock: GET returns NEW initially, UNDER_REVIEW after PUT
  let currentStatus = 'NEW'
  await page.unroute(`/api/messages/${MSG_ID}`)
  await page.route(`/api/messages/${MSG_ID}`, (route) =>
    route.fulfill({ json: { ...baseMessage, status: currentStatus } })
  )
  await page.route(`/api/messages/${MSG_ID}/status`, (route) => {
    currentStatus = 'UNDER_REVIEW'
    route.fulfill({ json: { ...baseMessage, status: 'UNDER_REVIEW' } })
  })
  await page.goto(`/messages/${MSG_ID}`)
  await page.getByRole('button', { name: 'Mark Under Review' }).click()
  await expect(page.getByTestId('status-badge')).toHaveText('UNDER REVIEW')
})

test('discard button sends DISCARDED status', async ({ page }) => {
  let sentStatus = ''
  await page.route(`/api/messages/${MSG_ID}/status`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    sentStatus = body.status
    await route.fulfill({ json: { ...baseMessage, status: 'DISCARDED' } })
  })
  await page.goto(`/messages/${MSG_ID}`)
  await page.getByRole('button', { name: 'Discard' }).click()
  expect(sentStatus).toBe('DISCARDED')
})

test('message not found shows error state', async ({ page }) => {
  await page.route(`/api/messages/${MSG_ID}`, (route) =>
    route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Message not found' } })
  )
  await page.goto(`/messages/${MSG_ID}`)
  await expect(page.getByText('Message not found')).toBeVisible()
})
