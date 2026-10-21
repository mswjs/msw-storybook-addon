import { test, expect } from '@playwright/test'
import { sidebarStory } from '../sidebar'

test('uses the handlers from preview', async ({ page }) => {
  await page.goto('/')
  await sidebarStory(page, 'Preview Handlers').click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'John Maverick (preview beforeEach)'
  )
})

test('supports story-level handler overrides', async ({ page }) => {
  await page.goto('/')
  await sidebarStory(page, 'Per-Story Handlers').click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Alice Sunwell (story beforeEach)'
  )
})

test('supports mocking an infinite loading state', async ({ page }) => {
  await page.goto('/')
  await sidebarStory(page, 'Loading State').click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')

  await page.waitForTimeout(500)
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')
})
