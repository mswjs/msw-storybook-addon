# Contribution guidelines

Hello and welcome to the repository! Thanks for taking the time to contribute.

## Issues

### Reporting bugs

Please write a clear and concise description of your issue. Provide a reproducible repository or a link for an online playground (e.g. CodeSandbox) if you can, that will help us solve your issues faster.

### Requesting features

Please write down the problem you facing and/or use-cases for the feature you're requesting. Not only it will make your feature request easier to understand, but also more appealing.

## Development guide

This project uses Yarn Workspaces to organize packages.

### Requirements

- Node.js
- Yarn

### Bootstraping

In the root folder, run the following command to install the dependencies:

```sh
$ yarn
```

### Development

This project is divided into two packages: `docs` and `msw-addon`.

#### **docs**

This is where the documentation and examples are placed. The documentation is part of Storybook in the `mdx` stories.

#### **msw-addon**

This is the Storybook addon code. You can build it and test it in the `docs` package, which has the addon linked as a dependency.

For development, here are the commands you can run (in the root folder):

```sh
# to build msw-addon in watch mode and run Storybook for examples
$ yarn start

# to start Storybook only (examples/docs)
# you can instead run `yarn storybook` under packages/docs if you prefer
$ yarn storybook

# to build msw-addon in watch mode only
# you can instead run `yarn dev` under packages/msw-addon if you prefer
$ yarn msw:dev
```
