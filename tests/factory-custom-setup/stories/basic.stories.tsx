import React, { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

type User = {
  name: string
}

function UserProfile() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('https://api.example.com/user')
      .then((response) => response.json() as Promise<User>)
      .then(setUser)
  }, [])

  if (!user) {
    return <p>Loading...</p>
  }

  return <p>{user.name}</p>
}

const meta = {
  title: 'Scenarios',
  component: UserProfile
} satisfies Meta<typeof UserProfile>

export default meta

type Story = StoryObj<typeof meta>

export const CustomSetup: Story = {
  async play({ canvas }) {
    await waitFor(async () => {
      await expect(canvas.getByRole('paragraph')).toHaveTextContent(
        'Custom Setup User'
      )
    })
  }
}
