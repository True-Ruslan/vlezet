import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "../../../apps/web/components/recognition/recognition-apply.ts",
  "../../../apps/web/components/projects/project-app.tsx",
  "../../../apps/web/components/editor/apartment-editor.tsx",
] as const;

describe("temporary exact source capture", () => {
  it("captures current orchestration sources in the standard CI diagnostic artifact", () => {
    for (const path of files) {
      const content = readFileSync(new URL(path, import.meta.url));
      console.log(`TASK15_SOURCE_BEGIN:${path}`);
      console.log(content.toString("base64"));
      console.log(`TASK15_SOURCE_END:${path}`);
    }
    expect.fail("temporary source capture complete");
  });
});
