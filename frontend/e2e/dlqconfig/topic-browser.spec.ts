import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

// TOPIC-004 + TOPIC-005: topics fetched on load; suggestions only after ≥2 chars
test('fetches topics on load and shows suggestions only after 2 chars', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq', 'payments.dlq', 'inventory.dlq'] } })
  )

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  const input = page.getByPlaceholder('my-service.dlq')

  // 1 char — no dropdown
  await input.fill('o')
  await expect(page.getByText('orders.dlq')).not.toBeVisible()

  // 2 chars — suggestions appear
  await input.fill('or')
  await expect(page.getByText('orders.dlq')).toBeVisible()
})

// TOPIC-006: selecting from dropdown fills the input and closes the dropdown
test('selecting a topic suggestion fills the input', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq', 'payments.dlq'] } })
  )

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  const input = page.getByPlaceholder('my-service.dlq')
  await input.fill('ord')
  await page.getByText('orders.dlq').click()
  await expect(input).toHaveValue('orders.dlq')
  await expect(page.getByText('payments.dlq')).not.toBeVisible()
})

// TOPIC-006: free-text entry not in list is accepted
test('user can type a topic name not present in the broker list', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq'] } })
  )

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('my-new-service.dlq')
  await expect(page.getByPlaceholder('my-service.dlq')).toHaveValue('my-new-service.dlq')
})

// TOPIC-007: typed name not in broker list → inline warning
test('warns when typed topic is not present on the broker', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq', 'payments.dlq'] } })
  )

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('topic-does-not-exist-yet')
  await expect(page.getByText(/Topic not found on broker/)).toBeVisible()
})

// TOPIC-008: broker unreachable → inline error shown in topic combobox
test('shows inline error when broker cannot be reached for topic listing', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({
      status: 422,
      json: {
        type: 'https://dls.io/errors/unprocessable-entity',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Cannot reach broker',
      },
    })
  )

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await expect(page.getByText(/Could not load topics from broker/)).toBeVisible()
})

// TOPIC-009: broker error does not block form submission
test('form can be submitted with manually typed topic when broker is unreachable', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ status: 422, json: { detail: 'Cannot reach broker' } })
  )
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        json: {
          id: '00000000-0000-0000-0000-000000000099',
          clusterId: CLUSTER_ID,
          topicName: 'manual.dlq',
          displayName: 'Manual DLQ',
          downloadMode: 'ON_DEMAND',
          cronExpression: null,
          batchSize: 100,
          retentionType: 'MAX_AGE_DAYS',
          retentionValue: 30,
          defaultReplayTopic: null,
          userAssignments: [],
        },
      })
    } else {
      route.fulfill({ json: [] })
    }
  })

  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('manual.dlq')
  await page.getByLabel('Display Name').fill('Manual DLQ')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()
  await expect(page.getByText('DLQ config created')).toBeVisible()
})
