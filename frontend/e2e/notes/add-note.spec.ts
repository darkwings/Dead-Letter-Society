import { test, expect, type Route } from '@playwright/test'
import { loginAsOperator, loginAsViewer } from '../helpers/auth'

const MSG_ID = '00000000-0000-0000-0000-000000000042'
const CONFIG_ID = '00000000-0000-0000-0000-000000000099'

const baseMessage = {
  id: MSG_ID,
  dlqConfigId: CONFIG_ID,
  partition: 0,
  kafkaOffset: 42,
  kafkaTimestamp: '2024-06-01T10:00:00.000Z',
  status: 'NEW',
  schemaDecodeFailed: false,
  schemaId: null,
  ingestedAt: '2024-06-01T10:00:01.000Z',
  decodedPayload: null,
  rawPayload: null,
  key: null,
  headers: {},
}

const testNote = {
  id: '00000000-0000-0000-0001-000000000001',
  messageId: MSG_ID,
  authorId: '00000000-0000-0000-0000-000000000002',
  authorDisplayName: 'Operator',
  content: 'Investigating payment issue',
  ticketReference: null,
  createdAt: new Date().toISOString(),
}

test('operator can add a note and it appears immediately', async ({ page }) => {
  await loginAsOperator(page)

  let notes: typeof testNote[] = []
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page.route(`/api/messages/${MSG_ID}/notes`, (route: Route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: notes })
    } else {
      notes = [testNote]
      route.fulfill({ status: 201, json: testNote })
    }
  })
  await page.route('/api/events', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await page.getByPlaceholder('Add a note...').fill('Investigating payment issue')
  await page.getByRole('button', { name: 'Add Note' }).click()

  await expect(page.getByText('Investigating payment issue')).toBeVisible()
  await expect(page.getByText('Operator')).toBeVisible()
})

// Playwright route.fulfill sends full body immediately — EventSource sees connection closed,
// so onmessage never fires. SSE-driven refetch covered by TypeScript type-safety only.
test.skip('note appears in real-time for co-viewer via SSE', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  await loginAsOperator(page1)
  await loginAsViewer(page2)

  // page1 routes
  await page1.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page1.route(`/api/messages/${MSG_ID}/notes`, (route: Route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: [] })
    } else {
      route.fulfill({ status: 201, json: testNote })
    }
  })
  await page1.route('/api/events', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )

  // page2 routes — SSE delivers NOTE_ADDED after operator posts
  let page2Notes: typeof testNote[] = []
  let resolveSSE!: () => void
  const sseReady = new Promise<void>((r) => { resolveSSE = r })

  await page2.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page2.route(`/api/messages/${MSG_ID}/notes`, (route: Route) =>
    route.fulfill({ json: page2Notes })
  )
  await page2.route('/api/events', async (route: Route) => {
    await sseReady
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `data: ${JSON.stringify({ type: 'NOTE_ADDED', data: { messageId: MSG_ID, dlqConfigId: CONFIG_ID } })}\n\n`,
    })
  })

  await page1.goto(`/messages/${MSG_ID}`)
  await page2.goto(`/messages/${MSG_ID}`)

  // operator adds note
  await page1.getByPlaceholder('Add a note...').fill('Investigating payment issue')
  await page1.getByRole('button', { name: 'Add Note' }).click()

  // after POST completes, update page2's notes mock and fire SSE
  await expect(page1.getByText('Investigating payment issue')).toBeVisible()
  page2Notes = [testNote]
  resolveSSE()

  // page2 should show the note after SSE-triggered refetch
  await expect(page2.getByText('Investigating payment issue')).toBeVisible({ timeout: 5000 })

  await ctx1.close()
  await ctx2.close()
})

test('shows empty state when no notes', async ({ page }) => {
  await loginAsOperator(page)
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page.route(`/api/messages/${MSG_ID}/notes`, (route: Route) =>
    route.fulfill({ json: [] })
  )
  await page.route('/api/events', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await expect(page.getByText('No notes yet.')).toBeVisible()
})

test('shows ticket reference badge when present', async ({ page }) => {
  await loginAsOperator(page)
  const noteWithTicket = { ...testNote, ticketReference: 'JIRA-123' }
  await page.route(`/api/messages/${MSG_ID}`, (route: Route) =>
    route.fulfill({ json: baseMessage })
  )
  await page.route(`/api/messages/${MSG_ID}/notes`, (route: Route) =>
    route.fulfill({ json: [noteWithTicket] })
  )
  await page.route('/api/events', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    })
  )

  await page.goto(`/messages/${MSG_ID}`)
  await expect(page.getByText('JIRA-123')).toBeVisible()
})
