# Recognition Benchmark Corpus

This directory contains the public-safe deterministic corpus for M7.8A.

## Corpus v1

The corpus contains exactly eight fixtures:

1. `clean-studio`;
2. `clean-multi-room`;
3. `openings-heavy`;
4. `labels-and-areas`;
5. `furniture-heavy`;
6. `low-resolution`;
7. `perspective-photo`;
8. `m7-3-regression-anonymized`.

The final fixture is a redrawn analogue of previously observed failure characteristics. It is not the original source plan and contains no original identifiers, dimensions or raster data.

## Generated files

`source-definitions.mjs` is the human-reviewable source of fixture geometry and provenance. The generator creates for every fixture:

- `source.png` — Chromium-rendered source raster;
- `source.sha256` — immutable source digest;
- `fixture.json` — calibrated ground truth;
- `segments.json` — deterministic Core Benchmark line evidence;
- optional `cloud-response.json` — sanitised provider snapshot.

Do not edit generated fixture directories manually. Change the source definition, regenerate all assets and review the resulting hashes and images.

## Commands

From `tools/recognition-benchmark`:

```bash
npm install --no-package-lock --no-audit --no-fund
npx playwright install chromium
npm run generate:fixtures
npm run verify:fixtures
```

Core loading and schema validation are also covered by `pnpm --filter @vlezet/recognition test`.

## Privacy and provenance

- Only `synthetic`, `redrawn-anonymized` or documented `licensed` provenance is allowed.
- Unverified internet images are forbidden.
- Raster metadata chunks carrying EXIF or text metadata are forbidden.
- The original privately supplied regression source must never be committed.
- Fixtures must remain below 2400 × 2400 pixels and 5 MiB.

## Baseline policy

The committed recognition baseline is generated only after both Core and Source Benchmark paths exist. CI may compare against a baseline but must never update it automatically. Every baseline change is an explicit reviewed commit with exact source and harness SHAs.
