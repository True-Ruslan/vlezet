import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateRecognitionBenchmarkFixtureV1, type RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";

export const APPROVED_RECOGNITION_FIXTURE_IDS = [
  "clean-studio",
  "clean-multi-room",
  "openings-heavy",
  "labels-and-areas",
  "furniture-heavy",
  "low-resolution",
  "perspective-photo",
  "m7-3-regression-anonymized",
  "clutter-symbol-regression",
] as const;

export type LoadedRecognitionBenchmarkFixture = Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  directory: string;
  sourcePath: string;
  segmentsPath: string;
  cloudResponsePath: string | null;
}>;

type CorpusManifestV1 = Readonly<{
  schemaVersion: "recognition-corpus-manifest-v1";
  corpusVersion: "recognition-corpus-v1";
  fixtureIds: readonly string[];
}>;

async function readJson(path: string, label: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    throw new Error(`${label} не найден: ${path}`, { cause });
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new Error(`${label} содержит некорректный JSON: ${path}`, { cause });
  }
}

function validateManifest(value: unknown): CorpusManifestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("manifest.json должен быть объектом.");
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== "recognition-corpus-manifest-v1" || input.corpusVersion !== "recognition-corpus-v1") {
    throw new Error("manifest.json содержит неподдерживаемую версию.");
  }
  if (!Array.isArray(input.fixtureIds) || input.fixtureIds.some((id) => typeof id !== "string" || !id)) {
    throw new Error("manifest.json.fixtureIds должен быть списком непустых строк.");
  }
  const fixtureIds = [...input.fixtureIds] as string[];
  if (new Set(fixtureIds).size !== fixtureIds.length) throw new Error("manifest.json.fixtureIds содержит повторы.");
  if (fixtureIds.length !== APPROVED_RECOGNITION_FIXTURE_IDS.length
    || fixtureIds.some((id, index) => id !== APPROVED_RECOGNITION_FIXTURE_IDS[index])) {
    throw new Error("manifest.json должен содержать ровно девять утверждённых fixtures в каноническом порядке.");
  }
  return { schemaVersion: "recognition-corpus-manifest-v1", corpusVersion: "recognition-corpus-v1", fixtureIds };
}

async function requireFile(path: string, label: string): Promise<void> {
  try {
    await access(path);
  } catch (cause) {
    throw new Error(`${label} не найден: ${path}`, { cause });
  }
}

export async function loadRecognitionBenchmarkCorpus(rootDirectory: string): Promise<readonly LoadedRecognitionBenchmarkFixture[]> {
  const root = resolve(rootDirectory);
  const manifest = validateManifest(await readJson(join(root, "manifest.json"), "Corpus manifest"));
  const directoryEntries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second));
  const expectedDirectories = [...manifest.fixtureIds].sort((first, second) => first.localeCompare(second));
  if (directoryEntries.join("\n") !== expectedDirectories.join("\n")) {
    throw new Error("Каталог корпуса содержит отсутствующие или лишние fixture-директории.");
  }

  const loaded: LoadedRecognitionBenchmarkFixture[] = [];
  for (const fixtureId of manifest.fixtureIds) {
    const directory = join(root, fixtureId);
    const fixture = validateRecognitionBenchmarkFixtureV1(await readJson(join(directory, "fixture.json"), `Fixture ${fixtureId}`));
    if (fixture.id !== fixtureId) throw new Error(`Fixture ${fixtureId} содержит несовпадающий id ${fixture.id}.`);
    const sourcePath = join(directory, fixture.source.fileName);
    const segmentsPath = join(directory, "segments.json");
    await requireFile(sourcePath, `${fixtureId} source`);
    await requireFile(segmentsPath, `${fixtureId} segments`);
    const cloudResponsePath = fixture.source.cloudResponseFileName
      ? join(directory, fixture.source.cloudResponseFileName)
      : null;
    if (cloudResponsePath) await requireFile(cloudResponsePath, `${fixtureId} cloud response`);
    loaded.push({ fixture, directory, sourcePath, segmentsPath, cloudResponsePath });
  }
  return loaded;
}
