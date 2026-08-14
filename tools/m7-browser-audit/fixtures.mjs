import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  runtimeErrorGuard: [async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });
    await use();
    expect(errors, "unexpected browser runtime errors").toEqual([]);
  }, { auto: true }],
});

export { expect };
