import { defineConfig } from 'vitest/config'

// Throwaway config so the live encryption check (root *.mjs) can be run in isolation:
//   npx vitest run --config vitest.encryption.config.js
// One name at a time works too, and keeps the other seed from writing rows again:
//   npx vitest run --config vitest.encryption.config.js seed-dummy-data
// Delete this file with tmp-encryption-check.mjs when done.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tmp-encryption-seed.mjs', 'seed-dummy-data.mjs'],
    globals: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
