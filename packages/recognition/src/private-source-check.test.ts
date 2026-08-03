import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertNoPrivateSourceBytes, verifyPrivateSourceDirectory } from "../../../tools/recognition-benchmark/private-source-check.mjs";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vlezet-private-source-"));
  temporaryRoots.push(root);
  return root;
}

function pngHeader(width: number, height: number, marker: number): Buffer {
  const buffer = Buffer.alloc(25);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = marker;
  return buffer;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function manifestFor(entries: Array<Readonly<{
  sourceId: string;
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
}>>) {
  return {
    schemaVersion: "recognition-private-source-manifest-v1",
    batchId: "product-owner-real-plans-2026-08-04",
    sources: entries.map((entry) => ({
      sourceId: entry.sourceId,
      sha256: sha256(entry.buffer),
      widthPx: entry.widthPx,
      heightPx: entry.heightPx,
      mediaType: "image/png",
      tags: ["test"],
      annotationStatus: "registered",
      redistribution: "not-committed",
    })),
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("M7.9 private recognition source byte guard", () => {
  it("rejects a missing local source directory", async () => {
    const parent = await temporaryDirectory();
    await expect(verifyPrivateSourceDirectory({
      root: join(parent, "missing"),
      manifest: manifestFor([]),
    })).rejects.toThrow(/does not exist|missing/i);
  });

  it("verifies every private source by digest, dimensions and media type regardless of local filename", async () => {
    const root = await temporaryDirectory();
    const first = pngHeader(1177, 884, 1);
    const second = pngHeader(818, 1270, 2);
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "arbitrary-name.bin"), first);
    await writeFile(join(root, "nested", "another-name.dat"), second);

    const report = await verifyPrivateSourceDirectory({
      root,
      manifest: manifestFor([
        { sourceId: "real-plan-001", buffer: first, widthPx: 1177, heightPx: 884 },
        { sourceId: "real-plan-002", buffer: second, widthPx: 818, heightPx: 1270 },
      ]),
    });

    expect(report).toEqual({
      verified: 2,
      sourceIds: ["real-plan-001", "real-plan-002"],
      filesScanned: 2,
    });
  });

  it("fails closed for an unknown digest and lists the missing source ID", async () => {
    const root = await temporaryDirectory();
    const expected = pngHeader(100, 200, 3);
    const actual = pngHeader(100, 200, 4);
    await writeFile(join(root, "source.png"), actual);

    await expect(verifyPrivateSourceDirectory({
      root,
      manifest: manifestFor([
        { sourceId: "real-plan-001", buffer: expected, widthPx: 100, heightPx: 200 },
      ]),
    })).rejects.toThrow(/digest.*real-plan-001|real-plan-001.*digest/i);
  });

  it("rejects duplicate local copies of the same registered source", async () => {
    const root = await temporaryDirectory();
    const source = pngHeader(100, 200, 5);
    await writeFile(join(root, "first.png"), source);
    await writeFile(join(root, "second.png"), source);

    await expect(verifyPrivateSourceDirectory({
      root,
      manifest: manifestFor([
        { sourceId: "real-plan-001", buffer: source, widthPx: 100, heightPx: 200 },
      ]),
    })).rejects.toThrow(/duplicate.*real-plan-001/i);
  });

  it("rejects dimension metadata that does not match the registered source", async () => {
    const root = await temporaryDirectory();
    const source = pngHeader(100, 200, 6);
    await writeFile(join(root, "source.png"), source);
    const manifest = manifestFor([
      { sourceId: "real-plan-001", buffer: source, widthPx: 100, heightPx: 200 },
    ]);
    manifest.sources[0] = { ...manifest.sources[0], widthPx: 101 };

    await expect(verifyPrivateSourceDirectory({ root, manifest })).rejects.toThrow(/dimensions.*real-plan-001/i);
  });

  it("rejects original private bytes found anywhere in a repository tree", async () => {
    const repositoryRoot = await temporaryDirectory();
    const source = pngHeader(100, 200, 7);
    await mkdir(join(repositoryRoot, "packages"));
    await writeFile(join(repositoryRoot, "packages", "leaked-source.png"), source);

    await expect(assertNoPrivateSourceBytes({
      repositoryRoot,
      manifest: manifestFor([
        { sourceId: "real-plan-001", buffer: source, widthPx: 100, heightPx: 200 },
      ]),
    })).rejects.toThrow(/private source.*real-plan-001/i);
  });

  it("ignores the explicitly local private-source directory while scanning a repository", async () => {
    const repositoryRoot = await temporaryDirectory();
    const source = pngHeader(100, 200, 8);
    const localRoot = join(repositoryRoot, ".local", "recognition-private-sources");
    await mkdir(localRoot, { recursive: true });
    await writeFile(join(localRoot, "source.png"), source);

    await expect(assertNoPrivateSourceBytes({
      repositoryRoot,
      manifest: manifestFor([
        { sourceId: "real-plan-001", buffer: source, widthPx: 100, heightPx: 200 },
      ]),
    })).resolves.toEqual({ filesScanned: 0, leaks: [] });
  });
});
