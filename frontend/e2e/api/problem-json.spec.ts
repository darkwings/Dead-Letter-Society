import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const configFixture = {
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
}

// API-001, API-002: frontend reads 'detail' from problem+json body and shows it as error message.
// The 'type' URI convention (https://dls.io/problems/<code>) is a backend contract verified
// in integration tests; here we verify the frontend correctly surfaces the detail field.
test('frontend displays detail field from problem+json error response as toast', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: configFixture })
  )
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 500,
        json: {
          type: 'https://dls.io/problems/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Unexpected error while saving DLQ config',
        },
      })
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Unexpected error while saving DLQ config')).toBeVisible()
})

// API-003: 422 response with 'violations' array causes per-field inline error display
test('422 violations array renders inline errors under the affected fields', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: configFixture })
  )
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 422,
        json: {
          type: 'https://dls.io/problems/validation',
          title: 'Validation Error',
          status: 422,
          detail: 'Validation failed',
          violations: [
            { field: 'cronExpression', message: 'Must be a valid quartz cron expression' },
            { field: 'batchSize', message: 'Must be between 1 and 10000' },
          ],
        },
      })
    } else {
      route.continue()
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText('Must be a valid quartz cron expression')).toBeVisible()
  await expect(page.getByText('Must be between 1 and 10000')).toBeVisible()
  await expect(page.getByText('Please fix the validation errors')).toBeVisible()
})
