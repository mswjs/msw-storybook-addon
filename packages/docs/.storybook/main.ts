import { dirname, join } from "path";
import replace from '@rollup/plugin-replace';

import { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],

  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-mdx-gfm"),
  ],

  framework: {
    name: getAbsolutePath("@storybook/react-vite") as '@storybook/react-vite',
    options: {},
  },

  staticDirs: ["../public"],

  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        preserveSymlinks: true,
      },
      plugins: [
        // Workaround necessary because of a bug in Vite
        // They replace the string process.env.NODE_ENV at build time, 
        // but they don't properly skip replacing globalThis.process.env.NODE_ENV so that graphql check becomes globalThis."development", which is invalid
        // https://github.com/graphql/graphql-js/issues/3918#issuecomment-1692475931
        replace({
          preventAssignment: true,
          'globalThis.process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
      ]
    });
  },
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}

export default config;
