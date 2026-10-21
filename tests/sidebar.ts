import type { Page } from '@playwright/test'

/**
 * A story in the Storybook sidebar: a link up to Storybook 11.0.0-alpha.0,
 * a tree grid row after it.
 */
export function sidebarStory(page: Page, name: string) {
  return page.getByRole('link', { name }).or(page.getByRole('row', { name }))
}
