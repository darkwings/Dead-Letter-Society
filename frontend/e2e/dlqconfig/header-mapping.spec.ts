import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

const CLUSTER_ID = '00000000-0000-0000-0000-000000000010'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'
const f = (name: string, encoding = 'STRING') => ({ name, encoding })
const presets = [
  { preset: 'LEGACY', mapping: { originalTopic: f('x-original-topic'), originalPartition: null, originalOffset: null, originalTimestamp: null, exceptionMessage: f('x-exception-message'), exceptionStacktrace: null } },
  { preset: 'SPRING', mapping: { originalTopic: f('kafka_dlt-original-topic'), originalPartition: f('kafka_dlt-original-partition', 'INT32'), originalOffset: f('kafka_dlt-original-offset', 'INT64'), originalTimestamp: f('kafka_dlt-original-timestamp', 'INT64'), exceptionMessage: f('kafka_dlt-exception-message'), exceptionStacktrace: f('kafka_dlt-exception-stacktrace') } },
  { preset: 'QUARKUS_SMALLRYE', mapping: { originalTopic: f('dead-letter-topic'), originalPartition: f('dead-letter-partition'), originalOffset: f('dead-letter-offset'), originalTimestamp: null, exceptionMessage: f('dead-letter-reason'), exceptionStacktrace: f('dead-letter-cause') } },
]

const created = (preset: string, mapping: unknown) => ({
  id: CONFIG_ID, clusterId: CLUSTER_ID, topicName: 'orders.dlq', displayName: 'O',
  downloadMode: 'ON_DEMAND', cronExpression: null, batchSize: 100,
  retentionType: 'MAX_AGE_DAYS', retentionValue: 30, defaultReplayTopic: null,
  headerPreset: preset, headerMapping: mapping, userAssignments: [],
})

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('/api/header-presets', (route) => route.fulfill({ json: presets }))
  await page.route(`/api/clusters/${CLUSTER_ID}/topics`, (route) =>
    route.fulfill({ json: { topics: ['orders.dlq'] } }))
})

// HDR-001: default preset is Legacy and fields are read-only
test('create form defaults to Legacy preset with read-only fields', async ({ page }) => {
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, (route) => route.fulfill({ json: [] }))
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await expect(page.getByLabel('Header Preset')).toHaveValue('LEGACY')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('x-original-topic')
  await expect(page.getByLabel('Original Topic header')).toBeDisabled()
})

// HDR-002: choosing Spring fills the fields and sends headerPreset in the POST
test('selecting Spring preset fills mapping and submits it', async ({ page }) => {
  let sent = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: created('SPRING', presets[1].mapping) })
    } else route.fulfill({ json: [] })
  })
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('O')
  await page.getByLabel('Header Preset').selectOption('SPRING')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('kafka_dlt-original-topic')
  await expect(page.getByLabel('Original Partition header')).toHaveValue('kafka_dlt-original-partition')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()
  await expect(page.getByText('DLQ config created')).toBeVisible()
  expect(JSON.parse(sent)).toMatchObject({ headerPreset: 'SPRING' })
})

// HDR-003: Custom makes fields editable and sends the edited mapping
test('custom preset allows editing header names', async ({ page }) => {
  let sent = ''
  await page.route(`/api/clusters/${CLUSTER_ID}/dlq-configs`, async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postData() ?? ''
      await route.fulfill({ status: 201, json: created('CUSTOM', {}) })
    } else route.fulfill({ json: [] })
  })
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/new`)
  await page.getByPlaceholder('my-service.dlq').fill('orders.dlq')
  await page.getByLabel('Display Name').fill('O')
  await page.getByLabel('Header Preset').selectOption('CUSTOM')
  await expect(page.getByLabel('Original Topic header')).toBeEnabled()
  await page.getByLabel('Original Topic header').fill('my-orig-topic')
  await page.getByRole('button', { name: 'Save DLQ Config' }).click()
  await expect(page.getByText('DLQ config created')).toBeVisible()
  const body = JSON.parse(sent)
  expect(body.headerPreset).toBe('CUSTOM')
  expect(body.headerMapping.originalTopic).toEqual({ name: 'my-orig-topic', encoding: 'STRING' })
  expect(body.headerMapping.originalPartition).toBeNull()
})

// HDR-004: edit form loads the stored preset
test('edit form shows stored preset and mapping', async ({ page }) => {
  await page.route(`/api/dlq-configs/${CONFIG_ID}`, (route) =>
    route.fulfill({ json: created('QUARKUS_SMALLRYE', presets[2].mapping) }))
  await page.goto(`/clusters/${CLUSTER_ID}/dlq-configs/${CONFIG_ID}/edit`)
  await expect(page.getByLabel('Header Preset')).toHaveValue('QUARKUS_SMALLRYE')
  await expect(page.getByLabel('Original Topic header')).toHaveValue('dead-letter-topic')
})
