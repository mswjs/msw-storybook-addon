import { test, expect } from '@playwright/test'

test('CSF3: uses initial handlers from initialize() in preview', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'initial handler defined in initialize() function',
  )
})

test('CSF3: supports per-story beforeEach({ msw }) overrides', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Per-Story Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'handler overriden in story beforeEach',
  )
})

test('CSF3: resets to initial handlers between stories', async ({ page }) => {
  await page.goto('/')
  // visit a story that overrides, then a story that should fall back
  await page.getByRole('link', { name: 'Per-Story Handlers' }).click()
  await page.getByRole('link', { name: 'Resets To Initial Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'initial handler defined in initialize() function',
  )
})

test('CSF3: supports infinite loading state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Loading State' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')

  await page.waitForTimeout(500)
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')
})
