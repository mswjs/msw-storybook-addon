import React from 'react';
import { rest } from 'msw';
import { UserProfile } from '../src/UserProfile';

const config = {
  title: 'User Profile',
  component: UserProfile,
};

export default config;

export const DefaultBehavior = () => <UserProfile />;

DefaultBehavior.story = {
  parameters: {
    msw: [
      rest.get('/user', (req, res, ctx) => {
        return res(
          ctx.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          }),
        );
      }),
    ]
  },
};

export const AnotherBehavior = () => <UserProfile />;

AnotherBehavior.story = {
  parameters: {
    msw: [
      rest.get('/user', (req, res, ctx) => {
        return res(
          ctx.json({
            firstName: 'Aditya',
            lastName: 'Agarwal',
          }),
        );
      }),
    ]
  },
};
