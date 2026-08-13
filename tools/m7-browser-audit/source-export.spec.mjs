import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(here, "artifacts");
mkdirSync(artifactDir, { recursive: true });
copyFileSync(
  resolve(here, "../../apps/web/components/editor/editor-canvas.tsx"),
  resolve(artifactDir, "editor-canvas-source.tsx"),
);
throw new Error("intentional temporary source-export stop");
