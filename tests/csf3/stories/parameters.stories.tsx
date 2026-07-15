import React, { useEffect, useState } from 'react'
import { http, HttpResponse } from 'msw'
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

// Meta-level `parameters.msw` in the record form (`handlers` keyed by name),
// inherited by every story in this file.
const meta = {
  title: 'Parameters',
  component: UserProfile,
  parameters: {
    msw: {
      handlers: {
        user: [
          http.get('https://api.example.com/user', () => {
            return HttpResponse.json({
              name: 'John Maverick (meta parameters)'
            })
          })
        ]
      }
    }
  }
} satisfies Meta<typeof UserProfile>

export default meta

type Story = StoryObj<typeof meta>

export const MetaParameters: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'John Maverick (meta parameters)'
      )
    })
  }
}

// Overriding a single key of the inherited `handlers` record: the story's
// `user` key replaces the meta's `user` key.
export const StoryOverride: Story = {
  parameters: {
    msw: {
      handlers: {
        user: [
          http.get('https://api.example.com/user', () => {
            return HttpResponse.json({
              name: 'Alice Sunwell (story parameters)'
            })
          })
        ]
      }
    }
  },
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'Alice Sunwell (story parameters)'
      )
    })
  }
}
