import React, { useEffect, useState } from 'react'
import { http, HttpResponse, delay } from 'msw'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

type User = {
  name: string
}

function UserProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetch('https://api.example.com/user')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        return response.json() as Promise<User>
      })
      .then(setUser)
      .catch(setError)
  }, [])

  if (error) return <p role="alert">Error: {error.message}</p>
  if (!user) return <p>Loading...</p>

  return <p>{user.name}</p>
}

const meta = {
  title: 'Scenarios',
  component: UserProfile
} satisfies Meta<typeof UserProfile>

export default meta

type Story = StoryObj<typeof meta>

export const PreviewHandlers: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'John Maverick (preview beforeEach)'
      )
    })
  }
}

export const StoryOverrides: Story = {
  name: 'Per-Story Handlers',
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({
          name: 'Alice Sunwell (story beforeEach)'
        })
      })
    )
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'Alice Sunwell (story beforeEach)'
      )
    })
  }
}

export const LoadingState: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', async () => {
        await delay('infinite')
      })
    )
  },
  async play({ canvas }) {
    await expect(canvas.getByRole('paragraph')).toHaveTextContent('Loading')
    await new Promise((resolve) => setTimeout(resolve, 500))
    await expect(canvas.getByRole('paragraph')).toHaveTextContent('Loading')
  }
}
