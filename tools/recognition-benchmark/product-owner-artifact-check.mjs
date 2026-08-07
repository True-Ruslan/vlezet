import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ARTIFACT_BYTES = 256 * 1024;
const ALLOWED_EXTENSIONS = new Set([".json", ".md"]);
const FORBIDDEN_PATTERNS = Object.freeze([
  /data:image/i,
  /base64/i,
  /Authorization\s*:\s*Bearer/i,
  /Bearer\s+sk-/i,
  /sk-or-v1-/i,
  /\bscreenshot(?:Data|DataUrl)?\b/i,
  /\bcoordinates?\b/i,
]);

function artifactPath(value, index) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Artifact path at index ${index} must be a non-empty string.`);
  }
  return resolve(value);
}

export async function assertProductOwnerArtifactFilesSafe(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("At least one product-owner artifact path is required.");
  }

  const normalized = paths.map(artifactPath);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Product-owner artifact paths must not contain duplicates.");
  }

  for (const path of normalized) {
    const extension = extname(path).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`Product-owner artifacts must be JSON or Markdown: ${path}.`);
    }

    const metadata = await stat(path);
    if (!metadata.isFile()) {
      throw new Error(`Product-owner artifact must be a regular file: ${path}.`);
    }
    if (metadata.size > MAX_ARTIFACT_BYTES) {
      throw new Error(`Product-owner artifact is too large: ${path}.`);
    }

    const content = await readFile(path, "utf8");
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(content))) {
      throw new Error(`Product-owner artifact contains forbidden material: ${path}.`);
    }
  }

  return Object.freeze({ filesScanned: normalized.length });
}

async function main() {
  const result = await assertProductOwnerArtifactFilesSafe(process.argv.slice(2));
  process.stdout.write(`Product-owner artifact privacy scan passed: ${result.filesScanned} files.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 1;
  });
}
