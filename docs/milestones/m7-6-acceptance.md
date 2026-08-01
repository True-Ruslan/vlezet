# M7.6 — Geometry and Opening Inspector Acceptance

**Status:** IMPLEMENTATION IN PROGRESS  
**Date:** 2026-08-01  
**Branch:** `feat/m7-6-geometry-opening-inspector`

## Scope

M7.6 owns `UX-GEO-001`, `UX-GEO-002` and `UX-GEO-003`:

- visually predictable room horizontal/vertical interior spans;
- wall centreline length with visible fixed endpoints;
- wall thickness with visible fixed surfaces;
- opening position measured from either visible wall end;
- accessible four-choice door swing selection;
- runtime-only Canvas emphasis/preview;
- local validation and one-step semantic Undo.

## Authority boundaries

M7.6 must not change `VlezetDocument`, schema/migrations, IndexedDB or backup formats, topology, room derivation, area calculation, snapping, hit testing, opening validation, command semantics, semantic-history grouping, recognition, planning or read-only 3D authority.

## Evidence

Automated and product-owner evidence will be recorded on the exact release-candidate head before integration.
