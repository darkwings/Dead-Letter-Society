import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

// SETTINGS-001: left nav with required sections
test('settings page shows left nav with General, Clusters, Members & Roles links', async ({ page }) => {
  await page.goto('/settings/general')
  // "General" link only appears in SettingsLayout nav, not the sidebar
  const nav = page.locator('nav').filter({ hasText: 'General' })
  await expect(nav.getByRole('link', { name: 'General' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Clusters' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Members & Roles' })).toBeVisible()
})

// SETTINGS-002: light/dark toggle present
test('settings general page shows a theme toggle button', async ({ page }) => {
  await page.goto('/settings/general')
  await expect(page.getByRole('button', { name: /Switch to (Light|Dark)/i })).toBeVisible()
})

// SETTINGS-003: toggle persists theme to localStorage
test('clicking theme toggle persists preference to localStorage', async ({ page }) => {
  await page.goto('/settings/general')

  // Default is dark; button says "Switch to Light"
  const toggleBtn = page.getByRole('button', { name: /Switch to Light/i })
  await expect(toggleBtn).toBeVisible()
  await toggleBtn.click()

  const stored = await page.evaluate(() => localStorage.getItem('dls-theme'))
  expect(stored).toBe('light')
  await expect(page.getByRole('button', { name: /Switch to Dark/i })).toBeVisible()
})

// SETTINGS-004: theme from localStorage applied on startup (no flash)
test('theme preference from localStorage is applied before first render', async ({ page }) => {
  // Set localStorage before page load
  await page.addInitScript(() => {
    localStorage.setItem('dls-theme', 'light')
  })

  await page.goto('/settings/general')

  const hasLightClass = await page.evaluate(() =>
    document.documentElement.classList.contains('light')
  )
  expect(hasLightClass).toBe(true)

  // Toggle button should reflect light mode
  await expect(page.getByRole('button', { name: /Switch to Dark/i })).toBeVisible()
})
