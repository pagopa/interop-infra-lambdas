import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    setupFiles: [],
    include: ["./test/unit/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",

    coverage: {
      provider: 'istanbul',
      reporter: ['html'],
      include: ['src/**/*.ts'],

      // Set coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});