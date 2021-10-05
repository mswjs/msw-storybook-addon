const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

function config(entry = []) {
  return [...entry, require.resolve('./dist/preset/addDecorator')];
}

function webpackFinal(config) {
  return {
    ...config,
    plugins: [
      ...config.plugins,
      new NodePolyfillPlugin()
    ],
  }
}

module.exports = {
  config,
  webpackFinal
};