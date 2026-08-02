# M7.8A Implementation Plan — Normative Self-Review

**Status:** NORMATIVE COMPANION  
**Date:** 2026-08-01  
**Applies to:** `docs/superpowers/plans/2026-08-01-m7-8a-recognition-benchmark-foundation.md`  
**Priority:** This document overrides conflicting sequencing, dependency, corpus and baseline details in the main implementation plan.

## 1. Review result

The main plan covers the approved M7.8A design, but self-review found six implementation ambiguities that must be resolved before code work:

1. benchmark TypeScript imports existing polygon primitives but the recognition package does not yet declare `@vlezet/geometry`;
2. corpus loading/file-presence validation has no dedicated owner file;
3. the final baseline was scheduled before Source Benchmark existed;
4. a baseline cannot truthfully record the SHA of the commit that contains itself;
5. fixture descriptions were not precise enough to prevent eight implementers from creating incompatible ground truth;
6. benchmark result `commitSha` and privacy-key allowlisting were underspecified.

The corrections below are mandatory.

## 2. Package dependency correction

Task 1 must modify `packages/recognition/package.json` in addition to the files already listed.

Add benchmark-only workspace geometry access as a development dependency:

```json
{
  "devDependencies": {
    "@vlezet/geometry": "workspace:*",
    "typescript": "6.0.3",
    "vitest": "4.1.10"
  }
}
```

Do not add `@vlezet/geometry` to runtime `dependencies`; benchmark modules are not exported from `@vlezet/recognition` and are not consumed by production code.

Run and commit `pnpm-lock.yaml` changes in Task 1:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
```

## 3. Dedicated corpus loader

Add these files to Task 8:

- Create `packages/recognition/benchmarks/src/load-corpus.ts`.
- Create `packages/recognition/benchmarks/src/load-corpus.test.ts`.

Required interface:

```ts
export type LoadedBenchmarkFixtureV1 = Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  directory: string;
  sourcePath: string;
  segmentEvidence: readonly DetectedLineSegment[];
  cloudResponse: unknown | null;
  sourceSha256: string;
}>;

export function loadRecognitionCorpusV1(rootDirectory: string): readonly LoadedBenchmarkFixtureV1[];
```

Normative behaviour:

- read `manifest.json` first;
- require exactly the eight approved fixture IDs in manifest order;
- reject duplicate or missing directories;
- validate `fixture.json` through `validateRecognitionBenchmarkFixtureV1`;
- require `source.png`, `source.sha256` and `segments.json`;
- verify source SHA-256 in Node as well as in the tool script;
- validate every segment coordinate as finite;
- load `cloud-response.json` only when declared by fixture metadata;
- reject undeclared extra JSON snapshots;
- return fixtures in manifest order, never filesystem order.

Focused RED tests must cover missing source, hash mismatch, missing segments, undeclared cloud snapshot and filesystem-order invariance.

## 4. Baseline sequencing correction

### 4.1 Task 8 does not create the final baseline

Override Task 8 file list:

- do **not** create `packages/recognition/benchmarks/baselines/recognition-v1.json` yet;
- implement result aggregation, comparison and a protected baseline writer;
- Core Benchmark runs in bootstrap mode only when no committed baseline exists and `RECOGNITION_BENCHMARK_BOOTSTRAP=1` is explicitly set;
- ordinary mode without a baseline must fail.

Required command behaviour during Task 8:

```bash
RECOGNITION_BENCHMARK_BOOTSTRAP=1 pnpm benchmark:recognition:core
```

This writes temporary Core results under `artifacts/` but does not write a baseline.

The writer must require both variables:

```text
RECOGNITION_BENCHMARK_WRITE_BASELINE=1
RECOGNITION_BENCHMARK_BASELINE_SOURCE_SHA=<40-character commit SHA>
```

It refuses to run when either is absent or malformed.

### 4.2 Commit implementation before generating baseline

After Task 10 Source Benchmark passes locally:

1. commit all scorer, corpus, shared-engine and Source Benchmark implementation;
2. obtain that exact commit SHA and call it `SOURCE_SHA`;
3. run Core and Source Benchmark on `SOURCE_SHA` without changing product/scorer files;
4. combine both reports;
5. generate the baseline with `RECOGNITION_BENCHMARK_BASELINE_SOURCE_SHA=$SOURCE_SHA`;
6. commit only the baseline and any deterministic report schema fixture in a separate commit.

The baseline records:

```ts
export type RecognitionBaselineMetadataV1 = Readonly<{
  corpusVersion: "recognition-corpus-v1";
  recognitionEngineVersion: string;
  productBaseCommitSha: "039ddba143cd03ddec0b090606dfdde752446014";
  harnessScorerCommitSha: string;
  generatedFromCommitSha: string;
}>;
```

For corpus v1, `harnessScorerCommitSha` and `generatedFromCommitSha` are both `SOURCE_SHA`.

The baseline-containing commit is intentionally different. It changes only evidence, not the behaviour measured from `SOURCE_SHA`.

### 4.3 Insert Task 10A

Add this normative task between Task 10 and Task 11.

#### Task 10A: Generate and Commit the Combined Baseline

**Files:**

- Create `packages/recognition/benchmarks/baselines/recognition-v1.json`.
- Test/update only baseline fixtures required by `compare-baseline.test.ts`.

**Steps:**

```bash
SOURCE_SHA=$(git rev-parse HEAD)
RECOGNITION_BENCHMARK_BOOTSTRAP=1 \
RECOGNITION_BENCHMARK_COMMIT_SHA="$SOURCE_SHA" \
pnpm benchmark:recognition:core

RECOGNITION_BENCHMARK_COMMIT_SHA="$SOURCE_SHA" \
pnpm benchmark:recognition:source

RECOGNITION_BENCHMARK_COMMIT_SHA="$SOURCE_SHA" \
pnpm benchmark:recognition:report

RECOGNITION_BENCHMARK_WRITE_BASELINE=1 \
RECOGNITION_BENCHMARK_BASELINE_SOURCE_SHA="$SOURCE_SHA" \
RECOGNITION_BENCHMARK_COMMIT_SHA="$SOURCE_SHA" \
pnpm benchmark:recognition:report
```

Then verify ordinary comparison:

```bash
pnpm benchmark:recognition:core
pnpm benchmark:recognition:source
pnpm benchmark:recognition:report
```

Commit:

```bash
git add packages/recognition/benchmarks/baselines/recognition-v1.json
git commit -m "test: record recognition benchmark baseline"
```

Task 11 may add merge-blocking CI only after this baseline commit exists.

## 5. Commit SHA contract

All benchmark commands resolve the measured commit in this order:

1. `RECOGNITION_BENCHMARK_COMMIT_SHA` when it is a 40-character lowercase hexadecimal SHA;
2. `GITHUB_SHA` under Actions when valid;
3. `git rev-parse HEAD` for local execution.

Create:

- `packages/recognition/benchmarks/src/commit-sha.ts`;
- `packages/recognition/benchmarks/src/commit-sha.test.ts`.

Interface:

```ts
export function resolveBenchmarkCommitSha(environment: NodeJS.ProcessEnv, cwd: string): string;
```

Fail closed when no valid SHA can be resolved. Never use `unknown`, branch names or abbreviated SHAs in result JSON.

`generatedAt` remains informational and excluded from canonical semantic equality; `commitSha` is not excluded.

## 6. Exact corpus v1 geometry

The source-definition generator and `fixture.json` files must implement the following reference-local millimetre geometry. Wall coordinates are centre-lines. IDs listed here are normative.

### 6.1 `clean-studio`

```text
source: 1200 × 900 px
scale: 5 mm/px
walls:
  w-n  (0,0)       → (6000,0)
  w-e  (6000,0)    → (6000,4500)
  w-s  (6000,4500) → (0,4500)
  w-w  (0,4500)    → (0,0)
openings:
  o-door-1   door    host w-s  centre (1200,4500) width 900
  o-window-1 window  host w-n  centre (1800,0)    width 1200
  o-window-2 window  host w-e  centre (6000,1900) width 1100
rooms:
  r-studio polygon (150,150),(5850,150),(5850,4350),(150,4350)
```

### 6.2 `clean-multi-room`

```text
source: 1800 × 1300 px
scale: 5 mm/px
outer walls: rectangle 9000 × 6500, IDs w-n,w-e,w-s,w-w
partitions:
  w-v (4000,0) → (4000,6500)
  w-h (0,3000) → (9000,3000)
rooms:
  r-nw (150,150)       → rectangle ending (3850,2850)
  r-ne (4150,150)      → rectangle ending (8850,2850)
  r-sw (150,3150)      → rectangle ending (3850,6350)
  r-se (4150,3150)     → rectangle ending (8850,6350)
openings:
  door on w-v centred (4000,1500), width 900
  door on w-v centred (4000,4700), width 900
  door on w-h centred (2000,3000), width 800
  door on w-h centred (6500,3000), width 800
```

### 6.3 `openings-heavy`

```text
source: 1600 × 1200 px
scale: 5 mm/px
outer walls: rectangle 8000 × 6000
partitions:
  w-v (3900,0) → (3900,6000)
  w-h (0,3100) → (8000,3100)
openings exactly six:
  doors: w-v at y=1450 width 900; w-v at y=4550 width 800; w-h at x=1900 width 800
  windows: w-n at x=1800 width 1300; w-e at y=1800 width 1200; w-s at x=6100 width 1400
include one non-ground-truth ambiguous arc near w-w
rooms: four inset rectangles using 150 mm wall clearance
```

### 6.4 `labels-and-areas`

```text
source: 1700 × 1200 px
scale: 5 mm/px
outer walls: rectangle 8500 × 6000
partitions:
  w-v       (3200,0)    → (3200,6000)
  w-left-h  (0,3000)    → (3200,3000)
  w-right-1 (3200,2200) → (8500,2200)
  w-right-2 (3200,4100) → (8500,4100)
rooms exactly five:
  r-living, r-bedroom, r-kitchen, r-bathroom, r-corridor
labels and stated areas:
  living 8.55 m²
  bedroom 8.10 m²
  kitchen 10.07 m²
  bathroom 8.76 m²
  corridor 9.80 m²
stated total: 45.28 m²
```

Computed polygon areas remain separately calculated from the inset polygons and need not equal stated values exactly.

### 6.5 `furniture-heavy`

```text
source: 1400 × 1000 px
scale: 5 mm/px
outer walls: rectangle 7000 × 5000
partitions:
  w-v (3000,0) → (3000,5000)
  w-h (3000,2600) → (7000,2600)
rooms: three inset polygons
openings: two doors, three windows
noise primitives not in ground truth:
  one bed rectangle with inner parallel contours
  one sofa with three cushion baselines
  one dining table plus four chairs
  toilet and bath contours
  hatch lines at 45°
  four dimension lines with arrowheads and numeric text
```

### 6.6 `low-resolution`

```text
source: 480 × 360 px
scale: 15 mm/px
outer walls: rectangle 7200 × 5400
partition:
  w-v (3600,0) → (3600,5400)
rooms: two inset rectangles
openings: one internal door, two outer windows
render with antialiasing and JPEG-like visual blocks drawn into the PNG, while the committed file remains PNG
```

### 6.7 `perspective-photo`

```text
source: 1600 × 1200 px
scale: 5 mm/px
expected wall centre-lines use distorted source-local coordinates:
  w-n (700,450)   → (7350,250)
  w-e (7350,250)  → (7700,5550)
  w-s (7700,5550) → (350,5800)
  w-w (350,5800)  → (700,450)
  w-v (3900,355)  → (4050,5670)
  w-h (520,3000)  → (7520,2820)
rooms: four quadrilaterals inset from these walls
openings: two doors and two windows on distorted hosts
noise: visible photographed-paper border and mild illumination gradient
```

This fixture intentionally exposes the current lack of perspective normalisation; the initial baseline may be poor.

### 6.8 `m7-3-regression-anonymized`

```text
source: 1800 × 1300 px
scale: 5 mm/px
outer walls: rectangle 9000 × 6500
partitions:
  w-v1 (2800,0)    → (2800,6500)
  w-v2 (6100,0)    → (6100,6500)
  w-h1 (0,2500)    → (6100,2500)
  w-h2 (2800,4400) → (9000,4400)
rooms: six spatial zones
openings: four doors and three windows on explicit hosts
labels: neutral names A–F with altered stated areas
noise:
  dense furniture and sanitary symbols
  dimension chains on all four sides
  door swing arcs
  coloured room fills
  image border
  several text baselines aligned with walls
```

The fixture metadata must state:

```json
{
  "provenance": {
    "kind": "redrawn-anonymized",
    "note": "Synthetic analogue preserving only the failure characteristics observed during M7.3 acceptance; no original raster, labels, dimensions or proportions are retained.",
    "license": null
  }
}
```

## 7. Privacy validation correction

Do not scan every JSON key with a broad `/name/` rejection because legitimate schema paths include room `name`.

The verifier uses an explicit allowlist of personal-data-like paths:

Allowed:

```text
expectedRooms[*].name
expectedLabels[*].text
```

Forbidden anywhere in fixture JSON or source definitions:

```text
personName
ownerName
address
street
apartmentNumber
phone
email
passport
contractNumber
qrCode
sourcePrivateHash
```

Additionally scan string values for:

- email pattern;
- Russian phone-like sequences of 10–11 digits;
- `кв.` followed by a number;
- URLs;
- UUIDs copied from private uploads.

Room labels in corpus v1 must be generic vocabulary or neutral A–F labels only.

## 8. Source Benchmark input correction

The workflow copies only the eight approved `source.png` files into the temporary public path. It must not copy fixture JSON, cloud snapshots, SHA files or source definitions into the Next public directory.

Required copy loop:

```bash
rm -rf apps/web/public/__recognition-benchmark-assets
mkdir -p apps/web/public/__recognition-benchmark-assets
while read -r fixture_id; do
  mkdir -p "apps/web/public/__recognition-benchmark-assets/$fixture_id"
  cp "packages/recognition/benchmarks/fixtures/$fixture_id/source.png" \
     "apps/web/public/__recognition-benchmark-assets/$fixture_id/source.png"
done < <(node -e 'const m=require("./packages/recognition/benchmarks/fixtures/manifest.json"); for (const id of m.fixtures) console.log(id)')
```

The browser receives only image URL and explicit calibrated metadata supplied by Playwright. Ground truth stays in the Node test process.

## 9. Standard CI bootstrap correction

Task 11 is implemented only after Task 10A baseline commit. Once `.github/workflows/ci.yml` gains the Core Benchmark step, bootstrap mode is forbidden.

Standard CI command is exactly:

```bash
pnpm benchmark:recognition:core
```

Workflow environment must not contain either:

```text
RECOGNITION_BENCHMARK_BOOTSTRAP
RECOGNITION_BENCHMARK_WRITE_BASELINE
```

Add a test that fails when baseline-writing mode is detected under `CI=true`.

## 10. Self-review completion checklist

The implementation plan is accepted only with these corrections applied:

- [x] all specification sections map to a task;
- [x] no runtime recognition model expansion is required;
- [x] package dependency ownership is explicit;
- [x] corpus file loading is explicit;
- [x] global optimal matching remains mandatory;
- [x] topology derivation remains deterministic;
- [x] eight fixture geometries are fixed;
- [x] private source material is excluded;
- [x] combined Core + Source baseline is generated only after both exist;
- [x] baseline provenance uses a real pre-baseline implementation SHA;
- [x] exact commit SHA resolution is fail-closed;
- [x] CI cannot bootstrap or rewrite evidence;
- [x] Source Benchmark exposes only source images to the browser;
- [x] product code remains unchanged except behaviour-preserving engine extraction and env-gated harness.