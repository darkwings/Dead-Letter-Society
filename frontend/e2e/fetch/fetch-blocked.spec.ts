import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'

// FETCH-010: on-demand fetch rejected with 409 when scheduled fetch is in progress
test('fetch blocked by concurrent scheduled fetch shows info toast', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({
      json: {
        id: CONFIG_ID,
        clusterId: CLUSTER_ID,
        topicName: 'orders.dlq',
        displayName: 'Orders DLQ',
        downloadMode: 'BOTH',
        cronExpression: '0 */5 * * * ?',
        batchSize: 100,
        retentionType: 'MAX_AGE_DAYS',
        retentionValue: 30,
        defaultReplayTopic: null,
        userAssignments: [],
      },
    })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/messages*`, (route) =>
    route.fulfill({ json: { messages: [], total: 0, page: 0, size: 20 } })
  )
  await page.route(`/api/dlq-configs/${CONFIG_ID}/fetch`, (route) =>
    route.fulfill({
      status: 409,
      json: {
        type: 'https://dls.io/errors/conflict',
        title: 'Conflict',
        status: 409,
        detail: `Fetch already in progress for DLQ config: ${CONFIG_ID}`,
      },
    })
  )
  await page.route('/api/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )

  await page.goto(`/dlq-configs/${CONFIG_ID}/messages`)
  await page.getByRole('button', { name: 'Fetch now' }).click()
  await expect(page.getByText('A fetch is already in progress.')).toBeVisible()
})
