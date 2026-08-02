import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const routablePage = join(appDirectory, "%5F%5Frecognition-benchmark", "page.tsx");
const privatePage = join(appDirectory, "__recognition-benchmark", "page.tsx");

describe("recognition benchmark harness route", () => {
  it("encodes leading underscores so Next.js publishes the guarded URL", () => {
    expect(existsSync(routablePage)).toBe(true);
    expect(existsSync(privatePage)).toBe(false);

    const routeSource = readFileSync(routablePage, "utf8");
    expect(routeSource).toContain('process.env.RECOGNITION_BENCHMARK_HARNESS !== "1"');
    expect(routeSource).toContain("notFound()");
  });
});
