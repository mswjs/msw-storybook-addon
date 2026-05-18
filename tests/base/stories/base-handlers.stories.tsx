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

// No handler here — falls back to the preview default.
export const PreviewHandlers: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'handler defined in preview beforeEach',
      )
    })
  },
}

// Overrides the preview default for this story only.
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

// Deprecated `parameters.msw`, still applied by the compat shim. Both the
// object and bare-array forms must keep working.
export const LegacyParametersObject: Story = {
  name: 'Legacy parameters.msw (object form)',
  parameters: {
    msw: {
      handlers: [
        http.get('https://api.example.com/user', () => {
          return HttpResponse.json({ name: 'legacy handler defined in story with parameters.msw' })
        }),
      ],
    },
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'legacy handler defined in story with parameters.msw',
      )
    })
  },
}

export const LegacyParametersArray: Story = {
  name: 'Legacy parameters.msw (array form)',
  parameters: {
    msw: [
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({ name: 'legacy handler defined in story with parameters.msw array form' })
      }),
    ],
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'legacy handler defined in story with parameters.msw array form',
      )
    })
  },
}

export const DelayFunctionLoadingState: Story = {
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
