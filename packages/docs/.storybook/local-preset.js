/**
 * to load the built addon in this test Storybook
 */
function previewAnnotations(entry = []) {
  return [...entry, require.resolve('../../msw-addon/dist/preview.mjs')];
}

function managerEntries(entry = []) {
  return [...entry, require.resolve('../../msw-addon/dist/manager.mjs')];
}

module.exports = {
  managerEntries,
  previewAnnotations,
};
