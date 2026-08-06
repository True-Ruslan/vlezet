import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /recognition-(?:ai-proposal-live|(?:real-)?source)\.spec\.mjs/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.RECOGNITION_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
