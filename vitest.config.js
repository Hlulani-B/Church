import { defineConfig } from 'vitest/config'

/*
  Tests live in tests/. They run in the plain node environment — nothing here touches the DOM or
  renders a component. The point is to lock the invariants on the check-in path (window, radius,
  cancel-null, already-marked, creator auto-yes, overlap) so the changes made every week on this
  project cannot quietly break them.
*/
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
})
