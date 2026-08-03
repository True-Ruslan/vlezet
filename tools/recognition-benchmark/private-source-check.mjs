import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePrivateSourceManifest } from "../../packages/recognition/benchmarks/real-analogues/schema.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const defaultManifestPath = join(
  repositoryRoot,
  "packages/recognition/benchmarks/real-analogues/private-source-manifest.json",
);
const defaultPrivateSourceRoot = join(repositoryRoot, ".local/recognition-private-sources");
const skippedRepositoryDirectories = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "coverage",
]);
const permittedLocalRoots = [
  [".local", "recognition-private-sources"].join(sep),
  [".local", "recognition-annotations"].join(sep),
];

function requireValidManifest(manifest) {
  const validation = validatePrivateSourceManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid private source manifest: ${validation.errors.join("; ")}`);
  }
  return manifest;
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function isPng(buffer) {
  return buffer.length >= 24
    && buffer[0] === 137
    && buffer[1] === 80
    && buffer[2] === 78
    && buffer[3] === 71
    && buffer[4] === 13
    && buffer[5] === 10
    && buffer[6] === 26
    && buffer[7] === 10
    && buffer.toString("ascii", 12, 16) === "IHDR";
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 3 < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      return {
        widthPx: buffer.readUInt16BE(offset + 5),
        heightPx: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function inspectImage(buffer) {
  if (isPng(buffer)) {
    return {
      mediaType: "image/png",
      widthPx: buffer.readUInt32BE(16),
      heightPx: buffer.readUInt32BE(20),
    };
  }
  const jpeg = jpegDimensions(buffer);
  if (jpeg) return { mediaType: "image/jpeg", ...jpeg };
  return null;
}

async function listRegularFiles(root, shouldSkipDirectory = () => false) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(path, entry.name)) await visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }
  await visit(root);
  return files;
}

async function assertDirectory(path, label) {
  let metadata;
  try {
    metadata = await stat(path);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${path}`);
    }
    throw cause;
  }
  if (!metadata.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
}

export async function verifyPrivateSourceDirectory({ root, manifest }) {
  requireValidManifest(manifest);
  await assertDirectory(root, "Private source directory");

  const expectedByDigest = new Map(manifest.sources.map((source) => [source.sha256, source]));
  const matchedBySourceId = new Map();
  const unknownFiles = [];
  const files = await listRegularFiles(root);

  for (const path of files) {
    const digest = await sha256File(path);
    const expected = expectedByDigest.get(digest);
    if (!expected) {
      unknownFiles.push(relative(root, path));
      continue;
    }
    if (matchedBySourceId.has(expected.sourceId)) {
      throw new Error(`Duplicate private source ${expected.sourceId}: ${relative(root, path)}`);
    }

    const buffer = await readFile(path);
    const image = inspectImage(buffer);
    if (!image || image.mediaType !== expected.mediaType) {
      throw new Error(`Media type mismatch for ${expected.sourceId}`);
    }
    if (image.widthPx !== expected.widthPx || image.heightPx !== expected.heightPx) {
      throw new Error(
        `Dimensions mismatch for ${expected.sourceId}: expected ${expected.widthPx}x${expected.heightPx}, got ${image.widthPx}x${image.heightPx}`,
      );
    }
    matchedBySourceId.set(expected.sourceId, path);
  }

  const missingSourceIds = manifest.sources
    .map((source) => source.sourceId)
    .filter((sourceId) => !matchedBySourceId.has(sourceId));
  if (missingSourceIds.length > 0 || unknownFiles.length > 0) {
    throw new Error([
      "Digest verification failed.",
      missingSourceIds.length > 0 ? `Missing source IDs: ${missingSourceIds.join(", ")}.` : "",
      unknownFiles.length > 0 ? `Unregistered files: ${unknownFiles.join(", ")}.` : "",
    ].filter(Boolean).join(" "));
  }

  return {
    verified: matchedBySourceId.size,
    sourceIds: manifest.sources.map((source) => source.sourceId),
    filesScanned: files.length,
  };
}

function isPermittedLocalPath(repositoryRootPath, path) {
  const repositoryRelativePath = relative(repositoryRootPath, path);
  return permittedLocalRoots.some((root) =>
    repositoryRelativePath === root || repositoryRelativePath.startsWith(`${root}${sep}`));
}

export async function assertNoPrivateSourceBytes({ repositoryRoot: root, manifest }) {
  requireValidManifest(manifest);
  await assertDirectory(root, "Repository root");
  const sourceIdByDigest = new Map(manifest.sources.map((source) => [source.sha256, source.sourceId]));
  const files = await listRegularFiles(root, (path, name) =>
    skippedRepositoryDirectories.has(name) || isPermittedLocalPath(root, path));
  const leaks = [];

  for (const path of files) {
    const digest = await sha256File(path);
    const sourceId = sourceIdByDigest.get(digest);
    if (sourceId) leaks.push({ sourceId, path: relative(root, path) });
  }

  if (leaks.length > 0) {
    const first = leaks[0];
    throw new Error(`Private source bytes detected for ${first.sourceId} at ${first.path}`);
  }
  return { filesScanned: files.length, leaks };
}

async function loadDefaultManifest() {
  return JSON.parse(await readFile(defaultManifestPath, "utf8"));
}

async function runCli() {
  const command = process.argv[2];
  const manifest = await loadDefaultManifest();
  if (command === "verify-local") {
    const root = resolve(process.argv[3] ?? defaultPrivateSourceRoot);
    const report = await verifyPrivateSourceDirectory({ root, manifest });
    console.log(`Verified ${report.verified} private recognition sources: ${report.sourceIds.join(", ")}`);
    return;
  }
  if (command === "assert-repository") {
    const root = resolve(process.argv[3] ?? repositoryRoot);
    const report = await assertNoPrivateSourceBytes({ repositoryRoot: root, manifest });
    console.log(`Scanned ${report.filesScanned} repository files; no private source bytes found.`);
    return;
  }
  throw new Error("Usage: private-source-check.mjs <verify-local|assert-repository> [path]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((cause) => {
    const message = cause instanceof Error ? cause.message : "Private source verification failed.";
    console.error(message);
    process.exitCode = 1;
  });
}
