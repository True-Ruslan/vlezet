import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadPrivateSourceManifest,
  validatePrivateSourceManifest,
} from "./real-private-source-manifest.mjs";

const EXPECTED = [
  ["real-plan-001", 1177, 884, "image/jpeg", "c9ed200640c13770821947a5d3628e357e7400679dd6bb174e2a52a6c0f2f9ef"],
  ["real-plan-002", 818, 1270, "image/png", "bd89ecb927d9c7d8bea0273c3124cbd30a7a62a156b8ff4903aca10aad753527"],
  ["real-plan-003", 936, 646, "image/png", "39e5b58fbf0e980e85f1e45f80376bdfa548c05c0a45e0d40a92721fb4f2d950"],
  ["real-plan-004", 1026, 1174, "image/png", "ddead2d9bcde29d4ad5b858327f0578ab5257fa2485aa031062ec60721d0d83f"],
  ["real-plan-005", 1108, 888, "image/png", "7d73b9995b1fed6080e83b125c19c641bbb2da31b5fb3754ce773126509c202a"],
  ["real-plan-006", 1148, 848, "image/png", "6f275e4c9ac2264287988d7528fb43960ed676ba7e0f1a979f246a06436314b2"],
  ["real-plan-007", 940, 710, "image/png", "b84719058cbd82b02ac7b223789158b8ba956d9b530bba8d2a85e26037f61ec5"],
  ["real-plan-008", 1502, 1488, "image/png", "5cf1f7e6368c5ec5ccd6fe1955d8c6e1e5f00166158e4e6e4a03f29233f4499e"],
  ["real-plan-009", 1002, 838, "image/png", "15f9a6e6c9e27f17b3928fb27d3bbda9e424ce2a4640668f6d5f4521680b3d17"],
  ["real-plan-010", 1084, 1316, "image/png", "d4b53a310d8d2be1822d1ba3e0320e3b915cb504caa93cd88f9fdcf4acb91b19"],
  ["real-plan-011", 1578, 1340, "image/png", "66f9f51a331384574ac5cabf77d98c3a9a0e302c006c4f31961f9cc610b9d968"],
  ["real-plan-012", 1424, 990, "image/png", "54ef43f094dd54eb1947e21a4623b11ff104812f87653c160c34849df9733203"],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads the immutable twelve-plan private source inventory", async () => {
  const manifest = await loadPrivateSourceManifest();
  assert.equal(manifest.schemaVersion, "recognition-private-source-manifest-v1");
  assert.equal(manifest.batchId, "product-owner-real-plans-2026-08-04");
  assert.equal(manifest.sources.length, 12);
  assert.deepEqual(
    manifest.sources.map(({ sourceId, widthPx, heightPx, mediaType, sha256 }) =>
      [sourceId, widthPx, heightPx, mediaType, sha256]),
    EXPECTED,
  );
  assert.deepEqual(validatePrivateSourceManifest(manifest), []);
});

test("rejects duplicate source IDs and duplicate digests", async () => {
  const manifest = clone(await loadPrivateSourceManifest());
  manifest.sources[1].sourceId = manifest.sources[0].sourceId;
  manifest.sources[2].sha256 = manifest.sources[0].sha256;
  const errors = validatePrivateSourceManifest(manifest);
  assert.ok(errors.some((error) => error.includes("duplicate sourceId")));
  assert.ok(errors.some((error) => error.includes("duplicate sha256")));
});

test("rejects paths, URLs, secrets and redistributable source declarations", async () => {
  const manifest = clone(await loadPrivateSourceManifest());
  Object.assign(manifest.sources[0], {
    sourcePath: "/Users/example/private.png",
    sourceUrl: "https://example.invalid/private.png",
    apiKey: "sk-or-v1-example",
    redistribution: "committed",
  });
  const errors = validatePrivateSourceManifest(manifest);
  assert.ok(errors.some((error) => error.includes("unexpected field sourcePath")));
  assert.ok(errors.some((error) => error.includes("unexpected field sourceUrl")));
  assert.ok(errors.some((error) => error.includes("unexpected field apiKey")));
  assert.ok(errors.some((error) => error.includes("redistribution")));
});

test("requires bounded dimensions, supported media types and canonical sha256", async () => {
  const manifest = clone(await loadPrivateSourceManifest());
  Object.assign(manifest.sources[0], {
    widthPx: 0,
    heightPx: 100_000,
    mediaType: "image/svg+xml",
    sha256: "ABC",
  });
  const errors = validatePrivateSourceManifest(manifest);
  assert.ok(errors.some((error) => error.includes("widthPx")));
  assert.ok(errors.some((error) => error.includes("heightPx")));
  assert.ok(errors.some((error) => error.includes("mediaType")));
  assert.ok(errors.some((error) => error.includes("sha256")));
});

test("keeps original plan rasters in an ignored local-only directory", async () => {
  const gitignore = await readFile(new URL("../../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /^\.local\/recognition-private-sources\/$/m);
});
