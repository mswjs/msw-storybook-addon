import { test, expect } from '@playwright/test'

test('uses the handlers from preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'John Maverick (preview beforeEach)'
  )
})
