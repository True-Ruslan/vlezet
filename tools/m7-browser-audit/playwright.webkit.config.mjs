import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["m7-webkit-smoke.spec.mjs", "m7-context-scroll.spec.mjs", "m7-canvas-feedback.spec.mjs"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "webkit-test-results",
  reporter: [["line"]],
  projects: [
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        baseURL: process.env.M7_BASE_URL ?? "http://127.0.0.1:3000",
        viewport: { width: 1440, height: 900 },
        locale: "ru-RU",
        colorScheme: "light",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off"
      }
    }
  ]
});