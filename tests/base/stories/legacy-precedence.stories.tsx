import React, { useEffect, useState } from 'react'
import { http, HttpResponse } from 'msw'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

function UserProfile() {
  const [user, setUser] = useState<{ name: string } | null>(null)

  useEffect(() => {
    fetch('https://api.example.com/user')
      .then((response) => response.json())
      .then(setUser)
  }, [])

  if (!user) return <p>Loading...</p>

  return <p>{user.name}</p>
}

// Pins the (deliberately surprising) precedence of the deprecated
// `parameters.msw` shim vs `beforeEach({ msw })`. The shim applies at
// render, after every `beforeEach`, so `parameters.msw` always wins.
// Documented in MIGRATION.md — do not "fix" these by reordering.
const meta = {
  title: 'Scenarios',
  component: UserProfile,
  // Meta-level legacy default: stands in for a not-yet-migrated global.
  parameters: {
    msw: [
      http.get('https://api.example.com/user', () =>
        HttpResponse.json({ name: 'meta parameters.msw default' }),
      ),
    ],
  },
} satisfies Meta<typeof UserProfile>

export default meta

type Story = StoryObj<typeof meta>

// Same story defines BOTH. `parameters.msw` (decorator, runs last) wins
// over the story's own `beforeEach({ msw })`. This is a footgun: the fix
// is to delete the param and keep `beforeEach`.
export const ParamAndBeforeEachSameStory: Story = {
  name: 'parameters.msw + beforeEach (same story)',
  parameters: {
    msw: [
      http.get('https://api.example.com/user', () =>
        HttpResponse.json({ name: 'parameters.msw wins' }),
      ),
    ],
  },
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () =>
        HttpResponse.json({ name: 'beforeEach loses' }),
      ),
    )
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'parameters.msw wins',
      )
    })
  },
}

// Broad (meta-level) legacy `parameters.msw` default vs a story-level
// `beforeEach({ msw })` override. The un-migrated default still wins, so a
// migrated story override is silently ignored until the default migrates
// too.
export const MigratedStoryUnderLegacyDefault: Story = {
  name: 'story beforeEach under meta parameters.msw',
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () =>
        HttpResponse.json({ name: 'story beforeEach override' }),
      ),
    )
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'meta parameters.msw default',
      )
    })
  },
}
