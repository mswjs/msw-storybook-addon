import { test, expect } from '@playwright/test'

test('resolves requests against the worker created by the custom setup function', async ({
  page
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Custom Setup' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Custom Setup User (custom setup)'
  )
})
