import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    sequence: { concurrent: false },
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://lfp:lfp_dev_password@localhost:5433/leadflow_dev",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6380",
      JWT_SECRET: "test-secret-minimum-32-chars-long-here",
      ENCRYPTION_KEY: "test-encryption-key-must-be-64-chars-long-padding-here-0000000000",
    },
  },
});
