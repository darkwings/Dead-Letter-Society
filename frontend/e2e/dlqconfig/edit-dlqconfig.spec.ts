import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const configFixture = {
  id: CONFIG_ID,
  clusterId: CLUSTER_ID,
  topicName: 'orders.dlq',
  displayName: 'Orders DLQ',
  downloadMode: 'ON_DEMAND' as const,
  cronExpression: null,
  batchSize: 100,
  retentionType: 'MAX_AGE_DAYS' as const,
  retentionValue: 30,
  defaultReplayTopic: null,
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: configFixture })
  )
})

// DLQCFG-008: topic name is shown as read-only
test('topic name field is read-only and shows immutability hint', async ({ page }) => {
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  const topicInput = page.getByDisplayValue('orders.dlq')
  await expect(topicInput).toBeVisible()
  await expect(topicInput).toHaveAttribute('readOnly', '')
  await expect(page.getByText('Topic name cannot be changed after creation.')).toBeVisible()
})

// DLQCFG-006, DLQCFG-007: edit fields → PUT sent → success toast → navigate to list
test('edits displayName and batchSize and navigates to DLQ config list on save', async ({ page }) => {
  let sentBody = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      sentBody = route.request().postData() ?? ''
      await route.fulfill({ json: { ...configFixture, displayName: 'Updated DLQ', batchSize: 200 } })
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByLabel('Display Name').clear()
  await page.getByLabel('Display Name').fill('Updated DLQ')
  await page.getByLabel('Batch Size').clear()
  await page.getByLabel('Batch Size').fill('200')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText('DLQ config updated')).toBeVisible()
  await expect(page).toHaveURL(`/clusters/${CLUSTER_ID}/dlq-configs`)
  const body = JSON.parse(sentBody)
  expect(body.displayName).toBe('Updated DLQ')
  expect(body.batchSize).toBe(200)
})

// DLQCFG-009: changing download mode preserves submitted form (no topicName in body)
test('PUT request body does not include topicName (immutable field)', async ({ page }) => {
  let sentBody = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      sentBody = route.request().postData() ?? ''
      await route.fulfill({ json: { ...configFixture, downloadMode: 'SCHEDULED', cronExpression: '0 0 * * * ?' } })
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByLabel('Download Mode').selectOption('SCHEDULED')
  await page.getByLabel('Cron Expression').fill('0 0 * * * ?')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText('DLQ config updated')).toBeVisible()
  const body = JSON.parse(sentBody)
  expect(body).not.toHaveProperty('topicName')
  expect(body.downloadMode).toBe('SCHEDULED')
})

// DLQCFG-010, DLQCFG-011: server 422 violations shown inline under the affected fields
test('server validation violations are shown inline under the affected fields', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 422,
        json: {
          type: 'https://dls.io/errors/validation-error',
          title: 'Validation Error',
          status: 422,
          detail: 'Validation failed',
          violations: [{ field: 'cronExpression', message: 'Invalid cron expression' }],
        },
      })
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText('Invalid cron expression')).toBeVisible()
  await expect(page.getByText('Please fix the validation errors')).toBeVisible()
})

// Cancel navigates back to the DLQ config list without saving
test('cancel button navigates to DLQ config list without PUT', async ({ page }) => {
  let putCalled = false
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      putCalled = true
      await route.continue()
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page).toHaveURL(`/clusters/${CLUSTER_ID}/dlq-configs`)
  expect(putCalled).toBe(false)
})
