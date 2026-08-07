import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertProductOwnerArtifactFilesSafe } from "../../../tools/recognition-benchmark/product-owner-artifact-check.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(name: string, content: string) {
  const root = await mkdtemp(join(tmpdir(), "vlezet-owner-artifact-"));
  temporaryRoots.push(root);
  const path = join(root, name);
  await writeFile(path, content, "utf8");
  return path;
}

describe("product-owner artifact privacy scan", () => {
  it("accepts only small sanitized JSON and Markdown evidence", async () => {
    const json = await fixture("review.json", JSON.stringify({ sourceSha256: "c".repeat(64), accepted: false }));
    const markdown = await fixture("verdict.md", "# Review\n\nStatus: BLOCKED\n");

    await expect(assertProductOwnerArtifactFilesSafe([json, markdown])).resolves.toEqual({ filesScanned: 2 });
  });

  it.each([
    ["embedded image", "data:image/png;base64,PRIVATE"],
    ["credential header", "Authorization: Bearer sk-or-v1-secret"],
    ["reviewer screenshot field", JSON.stringify({ screenshotData: "PRIVATE" })],
    ["coordinate field", JSON.stringify({ coordinates: [1, 2] })],
  ])("rejects %s material", async (_label, content) => {
    const path = await fixture("unsafe.json", content);
    await expect(assertProductOwnerArtifactFilesSafe([path])).rejects.toThrow(/forbidden material/i);
  });

  it("rejects unsupported extensions and oversized evidence", async () => {
    const text = await fixture("review.txt", "safe-looking");
    await expect(assertProductOwnerArtifactFilesSafe([text])).rejects.toThrow(/json or markdown/i);

    const huge = await fixture("review.json", "x".repeat(300_000));
    await expect(assertProductOwnerArtifactFilesSafe([huge])).rejects.toThrow(/too large/i);
  });
});
