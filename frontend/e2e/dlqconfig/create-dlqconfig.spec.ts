import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'

const createdConfig = {
  id: '00000000-0000-0000-0000-000000000099',
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
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/header-presets', (route) => route.fulfill({ json: [] }))
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq', 'payments.dlq', 'inventory.dlq'] } })
  )
})

// DLQCFG-001: create with ON_DEMAND mode → success toast + navigate to list
test('creates DLQ config with ON_DEMAND mode and navigates to config list', async ({ page }) => {
  let sentBody = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sentBody = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: createdConfig })
    } else {
      route.fulfill({ json: [] })
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('Orders DLQ')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()

  await expect(page.getByText('DLQ config created')).toBeVisible()
  await expect(page).toHaveURL(`/clusters/${CLUSTER_ID}/dlq-configs`)
  expect(JSON.parse(sentBody)).toMatchObject({ displayName: 'Orders DLQ', downloadMode: 'ON_DEMAND' })
})

// DLQCFG-002: switching to SCHEDULED mode shows mandatory cron expression field
test('cron expression field appears for SCHEDULED and BOTH modes', async ({ page }) => {
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)

  await expect(page.getByLabel('Cron Expression')).not.toBeVisible()

  await page.getByLabel('Download Mode').selectOption('SCHEDULED')
  await expect(page.getByLabel('Cron Expression')).toBeVisible()

  await page.getByLabel('Download Mode').selectOption('BOTH')
  await expect(page.getByLabel('Cron Expression')).toBeVisible()

  await page.getByLabel('Download Mode').selectOption('ON_DEMAND')
  await expect(page.getByLabel('Cron Expression')).not.toBeVisible()
})

// DLQCFG-003: user can type a custom cron expression and it is sent to backend
test('custom cron expression is submitted correctly', async ({ page }) => {
  let sentBody = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sentBody = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: { ...createdConfig, downloadMode: 'SCHEDULED', cronExpression: '0 */5 * * * ?' } })
    } else {
      route.fulfill({ json: [] })
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('Orders DLQ')
  await page.getByLabel('Download Mode').selectOption('SCHEDULED')
  await page.getByLabel('Cron Expression').fill('0 */5 * * * ?')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()

  await expect(page.getByText('DLQ config created')).toBeVisible()
  expect(JSON.parse(sentBody)).toMatchObject({ cronExpression: '0 */5 * * * ?' })
})
