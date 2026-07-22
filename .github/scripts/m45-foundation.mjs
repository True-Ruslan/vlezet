import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected snippet: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected unique snippet: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

edit("packages/projects/src/project.ts", (text) => {
  text = replaceOnce(text,
`export type ReferencePlan = Readonly<{
  assetId: string;
  source: ReferencePlanSource;`,
`export type ReferencePlan = Readonly<{
  assetId: string;
  referenceRevision: string;
  source: ReferencePlanSource;`,
"ReferencePlan revision field");

  text = replaceOnce(text,
`export function validateReferencePlan(value: unknown): ReferencePlan {
  const input = record(value, "Подложка");`,
`function legacyReferenceRevision(
  assetId: string,
  input: Record<string, unknown>,
  transform: Record<string, unknown>,
  calibration: Record<string, unknown>,
): string {
  const payload = JSON.stringify([
    assetId,
    input.source,
    input.widthPx,
    input.heightPx,
    transform.millimetersPerPixel,
    calibration.pointA,
    calibration.pointB,
    calibration.knownLengthMm,
    calibration.alignment,
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return \`legacy-\${(hash >>> 0).toString(16).padStart(8, "0")}\`;
}

export function validateReferencePlan(value: unknown): ReferencePlan {
  const input = record(value, "Подложка");`,
"legacy revision helper");

  text = replaceOnce(text,
`  return {
    assetId,
    source: validateReferenceSource(input.source),`,
`  return {
    assetId,
    referenceRevision: input.referenceRevision === undefined
      ? legacyReferenceRevision(assetId, input, transform, calibration)
      : text(input.referenceRevision, "Ревизия подложки"),
    source: validateReferenceSource(input.source),`,
"validate revision");
  return text;
});

edit("packages/projects/src/indexeddb.ts", (text) => {
  text = replaceOnce(text,
`import { validateProjectAsset, type ProjectAssetRecord, type ProjectAssetRepository } from "./assets";
import { validateProject, type VlezetProjectRecord } from "./project";
import type { ProjectRepository } from "./repository";

const DATABASE_NAME = "vlezet";
const DATABASE_VERSION = 2;
const PROJECTS_STORE = "projects";
const SETTINGS_STORE = "settings";
const ASSETS_STORE = "assets";
const UPDATED_AT_INDEX = "updatedAt";
const PROJECT_ID_INDEX = "projectId";
const LAST_PROJECT_KEY = "lastProjectId";`,
`import { validateProjectAsset, type ProjectAssetRecord, type ProjectAssetRepository } from "./assets";
import {
  ASSETS_STORE,
  LAST_PROJECT_KEY,
  PROJECTS_STORE,
  PROJECT_ID_INDEX,
  RECOGNITION_SESSIONS_STORE,
  SETTINGS_STORE,
  UPDATED_AT_INDEX,
  VLEZET_DATABASE_NAME,
  VLEZET_DATABASE_VERSION,
} from "./indexeddb-schema";
import { validateProject, type VlezetProjectRecord } from "./project";
import type { ProjectRepository } from "./repository";`,
"indexeddb constants");

  text = text.replace("factory.open(DATABASE_NAME, DATABASE_VERSION)", "factory.open(VLEZET_DATABASE_NAME, VLEZET_DATABASE_VERSION)");

  text = replaceOnce(text,
`      if (!assets.indexNames.contains(PROJECT_ID_INDEX)) {
        assets.createIndex(PROJECT_ID_INDEX, "projectId", { unique: false });
      }
    };`,
`      if (!assets.indexNames.contains(PROJECT_ID_INDEX)) {
        assets.createIndex(PROJECT_ID_INDEX, "projectId", { unique: false });
      }
      const recognitionSessions = database.objectStoreNames.contains(RECOGNITION_SESSIONS_STORE)
        ? request.transaction!.objectStore(RECOGNITION_SESSIONS_STORE)
        : database.createObjectStore(RECOGNITION_SESSIONS_STORE, { keyPath: "id" });
      if (!recognitionSessions.indexNames.contains(PROJECT_ID_INDEX)) {
        recognitionSessions.createIndex(PROJECT_ID_INDEX, "projectId", { unique: true });
      }
    };`,
"recognitionSessions store");
  return text;
});

edit("packages/projects/src/index.ts", (text) => {
  return text + `\nexport {\n  ASSETS_STORE,\n  LAST_PROJECT_KEY,\n  PROJECTS_STORE,\n  PROJECT_ID_INDEX,\n  RECOGNITION_SESSIONS_STORE,\n  SETTINGS_STORE,\n  UPDATED_AT_INDEX,\n  VLEZET_DATABASE_NAME,\n  VLEZET_DATABASE_VERSION,\n} from "./indexeddb-schema";\n`;
});

edit("apps/web/components/reference/reference-service.ts", (text) => {
  text = replaceOnce(text,
`  assetId: string;
  now: string;`,
`  assetId: string;
  referenceRevision: string;
  now: string;`,
"install revision input");
  text = replaceOnce(text,
`  const next = replaceProjectReferencePlan(input.project, {
    assetId: asset.id,
    source: input.source,`,
`  const next = replaceProjectReferencePlan(input.project, {
    assetId: asset.id,
    referenceRevision: input.referenceRevision,
    source: input.source,`,
"install revision value");
  return text;
});

edit("apps/web/components/projects/project-app.tsx", (text) => {
  return replaceOnce(text,
`      assetId: crypto.randomUUID(),
      now: new Date().toISOString(),`,
`      assetId: crypto.randomUUID(),
      referenceRevision: crypto.randomUUID(),
      now: new Date().toISOString(),`,
"project app revision UUID");
});

console.log("M4.5 foundation codemod applied successfully.");
