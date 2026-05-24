import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const MSG_ID = '00000000-0000-0000-0000-000000000001'

const makeMessages = (count: number, overrides: Record<string, unknown> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    dlqConfigId: CONFIG_ID,
    partition: 0,
    kafkaOffset: i,
    kafkaTimestamp: new Date(Date.now() - i * 60_000).toISOString(),
    status: 'NEW',
    schemaDecodeFailed: false,
    schemaId: null,
    ingestedAt: new Date().toISOString(),
    ...overrides,
  }))

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

test('message list renders rows and status badges', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({
      json: { messages: makeMessages(3), total: 3, page: 0, size: 20 },
    })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  const rows = page.getByTestId('message-row')
  await expect(rows).toHaveCount(3)
  await expect(rows.first().getByTestId('status-badge')).toHaveText('NEW')
})

test('filter by status NEW shows only new messages', async ({ page }) => {
  const newMessages = makeMessages(2, { status: 'NEW' })
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({
      json: { messages: newMessages, total: 2, page: 0, size: 20 },
    })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByRole('combobox', { name: 'Status' }).selectOption('NEW')
  await page.getByRole('button', { name: 'Apply' }).click()
  const rows = page.getByTestId('message-row')
  for (const row of await rows.all()) {
    await expect(row.getByTestId('status-badge')).toHaveText('NEW')
  }
})

test('empty state shown when no messages', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 20 } })
  )
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await expect(page.getByText('No messages found.')).toBeVisible()
})

test('pagination: next button advances page', async ({ page }) => {
  let requestedPage = 0
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) => {
    const url = new URL(route.request().url())
    requestedPage = Number(url.searchParams.get('page') ?? 0)
    route.fulfill({
      json: { messages: makeMessages(20), total: 45, page: requestedPage, size: 20 },
    })
  })
  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByRole('button', { name: 'Next' }).click()
  expect(requestedPage).toBe(1)
})
