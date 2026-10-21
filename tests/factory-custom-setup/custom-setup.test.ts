import { test, expect } from '@playwright/test'
import { sidebarStory } from '../sidebar'

test('resolves requests against the worker created by the custom setup function', async ({
  page
}) => {
  await page.goto('/')
  await sidebarStory(page, 'Custom Setup').click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Custom Setup User (custom setup)'
  )
})
