import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
    sequence: { shuffle: true },
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts', 'src/server/**/*.ts'],
      exclude: ['src/server/index.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
