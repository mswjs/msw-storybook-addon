import { test, expect } from '@playwright/test'

test('uses the handlers from preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'John Maverick (preview parameters)'
  )
})

test('supports story-level handler overrides', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Per-Story Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Alice Sunwell (story parameters)'
  )
})

test('supports mocking an infinite loading state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Loading State' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')

  await page.waitForTimeout(500)
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')
})

test('uses the record-form handlers from meta', async ({ page }) => {
  await page.goto('/iframe.html?id=parameters--meta-parameters')

  await expect(page.getByRole('paragraph')).toHaveText(
    'John Maverick (meta parameters)'
  )
})

test('supports overriding a single key of the handlers record', async ({
  page
}) => {
  await page.goto('/iframe.html?id=parameters--story-override')

  await expect(page.getByRole('paragraph')).toHaveText(
    'Alice Sunwell (story parameters)'
  )
})
