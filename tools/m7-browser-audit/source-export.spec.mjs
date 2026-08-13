import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(here, "artifacts");
mkdirSync(artifactDir, { recursive: true });
copyFileSync(
  resolve(here, "../../apps/web/components/editor/editor-canvas.tsx"),
  resolve(artifactDir, "editor-canvas-source.tsx"),
);

test("exports current editor canvas source for connector-safe patching", async () => {});
