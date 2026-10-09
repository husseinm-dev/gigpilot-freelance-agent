import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 60_000,
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? "postgres://e2e:e2e@localhost:5432/e2e",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-test-secret-0123456789",
        },
      },
});
