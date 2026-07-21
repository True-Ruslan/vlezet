# M4 implementation notes

Implementation is intentionally staged through CI:

1. Project metadata, binary assets and calibration geometry.
2. Browser import, normalization and tracing UX.
3. PDF page rasterization, portable backup and export.

Each stage must pass tests, typecheck, lint and build before the next stage is considered complete.
