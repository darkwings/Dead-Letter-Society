import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

// MSG-003: payload preview shows first 80 chars truncated with '…'
test('payload preview is truncated to 80 characters with ellipsis', async ({ page }) => {
  await loginAsAdmin(page)
  const longPayload = { description: 'x'.repeat(100) }
  // JSON.stringify({description: 'xxx...'}) is well over 80 chars
  const msg = {
    id: '00000000-0000-0000-0000-000000000001',
    dlqConfigId: CONFIG_ID,
    partition: 0,
    kafkaOffset: 1,
    kafkaTimestamp: '2024-06-01T10:00:00.000Z',
    status: 'NEW',
    schemaDecodeFailed: false,
    schemaId: null,
    ingestedAt: '2024-06-01T10:00:01.000Z',
    decodedPayload: longPayload,
    headers: {},
  }
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [msg], total: 1, page: 0, size: 20 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: null } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  // Payload preview ends with '…' (unicode ellipsis)
  await expect(page.getByTestId('message-row').first()).toContainText('…')
})

test('payload preview shows dash when no decoded payload', async ({ page }) => {
  await loginAsAdmin(page)
  const msg = {
    id: '00000000-0000-0000-0000-000000000002',
    dlqConfigId: CONFIG_ID,
    partition: 0,
    kafkaOffset: 2,
    kafkaTimestamp: '2024-06-01T10:00:00.000Z',
    status: 'NEW',
    schemaDecodeFailed: false,
    schemaId: null,
    ingestedAt: '2024-06-01T10:00:01.000Z',
    decodedPayload: null,
    headers: {},
  }
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [msg], total: 1, page: 0, size: 20 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: { id: CONFIG_ID, displayName: 'Orders DLQ', defaultReplayTopic: null } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await expect(page.getByTestId('message-row').first()).toContainText('—')
})
