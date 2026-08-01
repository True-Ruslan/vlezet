import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["m7-audit.spec.mjs", "m7-context-scroll.spec.mjs", "m7-design-system.spec.mjs", "m7-canvas-feedback.spec.mjs", "m7-geometry-inspector.spec.mjs"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "test-results",
  reporter: [["line"]],
  use: {
    baseURL: process.env.M7_BASE_URL ?? "http://127.0.0.1:3000",
    locale: "ru-RU",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  }
});