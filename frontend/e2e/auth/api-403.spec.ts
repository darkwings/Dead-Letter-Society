import { test, expect } from '@playwright/test'
import { loginAsViewer } from '../helpers/auth'

const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'

// AUTH-013: unauthorized API call returns HTTP 403 with a human-readable role requirement.
// The viewer (globalRole: USER) clicks "Fetch now" which the backend rejects with 403.
// The frontend surfaces the 'detail' field from the problem+json response as an error toast.
test('403 from API with specific role message is shown as error toast', async ({ page }) => {
  await loginAsViewer(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({
      json: {
        id: CONFIG_ID,
        clusterId: CLUSTER_ID,
        topicName: 'orders.dlq',
        displayName: 'Orders DLQ',
        downloadMode: 'ON_DEMAND',
        cronExpression: null,
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
      status: 403,
      json: {
        type: 'https://dls.io/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'OPERATOR role required',
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
  await expect(page.getByText('OPERATOR role required')).toBeVisible()
})
