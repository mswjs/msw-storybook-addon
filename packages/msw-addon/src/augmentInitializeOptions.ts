import { InitializeOptions } from "./initialize.js";

const fileExtensionPattern = /\.(js|jsx|ts|tsx|mjs|woff|woff2|ttf|otf|eot)$/;
const filteredURLSubstrings = [
  "sb-common-assets",
  "node_modules",
  "node-modules",
  "hot-update.json",
  "__webpack_hmr",
  "sb-vite",
];

const shouldFilterUrl = (url: string) => {
  // files which are mostly noise from webpack/vite builders + font files
  if (fileExtensionPattern.test(url)) {
    return true;
  }

  const isStorybookRequest = filteredURLSubstrings.some((substring) =>
    url.includes(substring)
  );

  if (isStorybookRequest) {
    return true;
  }

  return false;
};

export const augmentInitializeOptions = (options: InitializeOptions) => {
  if (typeof options?.onUnhandledRequest === "string") {
    return options;
  }

  return {
    ...options,
    // Filter requests that we know are not relevant to the user e.g. HMR, builder requests, statics assets, etc.
    onUnhandledRequest: (...args) => {
      const [{ url }, print] = args;
      if (shouldFilterUrl(url)) {
        return;
      }

      if (!options?.onUnhandledRequest) {
        print.warning();
        return;
      }

      if (typeof options?.onUnhandledRequest === "function") {
        options.onUnhandledRequest(...args);
      }
    },
  } as InitializeOptions;
};
