import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { APPROVED_RECOGNITION_FIXTURE_IDS, loadRecognitionBenchmarkCorpus } from "./load-corpus";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("recognition benchmark corpus loader", () => {
  it("loads exactly the nine approved committed fixtures in stable order", async () => {
    const root = fileURLToPath(new URL("../fixtures", import.meta.url));
    const corpus = await loadRecognitionBenchmarkCorpus(root);
    expect(corpus.map((fixture) => fixture.fixture.id)).toEqual(APPROVED_RECOGNITION_FIXTURE_IDS);
    expect(corpus).toHaveLength(9);
    for (const fixture of corpus) {
      expect(fixture.sourcePath.endsWith("source.png")).toBe(true);
      expect(fixture.segmentsPath.endsWith("segments.json")).toBe(true);
    }
  });

  it("fails closed when a manifest references missing fixture directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "vlezet-recognition-corpus-"));
    temporaryDirectories.push(root);
    await writeFile(join(root, "manifest.json"), JSON.stringify({
      schemaVersion: "recognition-corpus-manifest-v1",
      corpusVersion: "recognition-corpus-v1",
      fixtureIds: APPROVED_RECOGNITION_FIXTURE_IDS,
    }));
    await expect(loadRecognitionBenchmarkCorpus(root)).rejects.toThrow(/fixture-директории/);
  });
});
