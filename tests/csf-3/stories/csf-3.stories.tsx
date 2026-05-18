import React, { useEffect, useState } from 'react'
import { http, HttpResponse, delay } from 'msw'
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

const meta = {
  title: 'Scenarios',
  component: UserProfile,
} satisfies Meta<typeof UserProfile>

export default meta

type Story = StoryObj<typeof meta>

export const PreviewHandlers: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'initial handler defined in initialize() function',
      )
    })
  },
}

export const StoryOverrides: Story = {
  name: 'Per-Story Handlers',
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({ name: 'handler overriden in story beforeEach' })
      }),
    )
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'handler overriden in story beforeEach',
      )
    })
  },
}

// After a per-story override, the reset falls back to the `initialize()`
// initial handlers — they survive `resetHandlers()`.
export const ResetsToInitialHandlers: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'initial handler defined in initialize() function',
      )
    })
  },
}

export const LoadingState: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', async () => {
        await delay('infinite')
      }),
    )
  },
  async play({ canvas }) {
    await expect(canvas.getByRole('paragraph')).toHaveTextContent('Loading')
    await new Promise((resolve) => setTimeout(resolve, 500))
    await expect(canvas.getByRole('paragraph')).toHaveTextContent('Loading')
  },
}
