import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

test('create cluster page renders form fields', async ({ page }) => {
  await page.route('/api/clusters', (route) => route.fulfill({ json: [] }))
  await page.goto('/clusters/new')
  await expect(page.getByLabel('Name')).toBeVisible()
  await expect(page.getByLabel('Bootstrap Servers')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Cluster' })).toBeVisible()
})

test('create cluster with unreachable SR shows blocking error', async ({ page }) => {
  await page.route('/api/clusters', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 422,
        json: { code: 'CONNECTIVITY_ERROR', message: 'Schema Registry: unreachable host' },
      })
    } else {
      await route.fulfill({ json: [] })
    }
  })
  await page.goto('/clusters/new')
  await page.getByLabel('Name').fill('Test Cluster')
  await page.getByLabel('Bootstrap Servers').fill('localhost:9092')
  await page.getByLabel('Schema Registry URL (optional)').fill('http://unreachable:8081')
  await page.getByRole('button', { name: 'Save Cluster' }).click()
  await expect(page.getByText('Schema Registry: unreachable host')).toBeVisible()
})

test('successful cluster creation redirects to cluster list', async ({ page }) => {
  await page.route('/api/clusters', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        json: {
          id: '00000000-0000-0000-0000-000000000042',
          name: 'Prod Kafka',
          bootstrapServers: 'kafka:9092',
          securityProtocol: 'PLAINTEXT',
          hasSchemaRegistry: false,
        },
      })
    } else {
      await route.fulfill({ json: [] })
    }
  })
  await page.goto('/clusters/new')
  await page.getByLabel('Name').fill('Prod Kafka')
  await page.getByLabel('Bootstrap Servers').fill('kafka:9092')
  await page.getByRole('button', { name: 'Save Cluster' }).click()
  await expect(page).toHaveURL('/clusters')
})

test('cluster list shows empty state message', async ({ page }) => {
  await page.route('/api/clusters', (route) => route.fulfill({ json: [] }))
  await page.goto('/clusters')
  await expect(page.getByText('No clusters configured')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add Cluster' })).toBeVisible()
})
