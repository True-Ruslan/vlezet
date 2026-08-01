# M7.7 Furniture and Fit Workflow — Normative Clarifications

**Status:** normative companion to `2026-08-01-m7-7-furniture-fit-workflow-design.md`  
**Date:** 2026-08-01

These clarifications resolve ambiguities found during the mandatory specification self-review. They do not change the approved product direction.

## 1. Catalogue filter ownership

Search text and selected category must survive closing and reopening the catalogue during the same mounted editor session, even when the catalogue component itself unmounts.

Therefore the state must live in either:

- a dedicated runtime-only catalogue UI store; or
- a stable editor parent that outlives the catalogue surface.

It must not live only in an unmounted `FurnitureCatalog` component, and it must never be added to `VlezetDocument`, project persistence, portable backup or semantic history.

## 2. Search normalisation

Punctuation is replaced with whitespace before whitespace collapse. It is not simply deleted.

Canonical sequence:

1. Unicode NFKC;
2. lowercase;
3. replace `ё` with `е`;
4. replace punctuation and separators with spaces;
5. trim;
6. collapse repeated whitespace;
7. split into non-empty tokens.

This makes `ТВ-тумба`, `тв тумба` and `ТВ / тумба` equivalent for deterministic token matching.

The result summary always displays the number of matching presets. When a query or non-default category is active, it additionally names the active filter context.

## 3. Height-field semantics

An empty height draft never deletes or invents height.

- If the authoritative object has no height, an empty field omits `height` from the patch and the object remains without height.
- If the authoritative object has height, an empty field omits `height` from the patch and preserves the existing height.
- A non-empty height must parse to a finite number greater than zero.

M7.7 does not add a separate “remove height” operation.

## 4. Hidden-section validation

If Apply finds an invalid field inside a collapsed section:

- the containing section automatically opens;
- all detectable field errors are rendered;
- focus moves to the first invalid field in document order after rendering;
- entered values remain unchanged;
- no editor-store mutation occurs.

This applies to `Зоны использования` and `Точное положение`.

## 5. Orientation-cue state

The store-free orientation cue receives an explicit per-side presentation map rather than a vague global invalid flag:

```ts
type ClearanceSidePresentation = Readonly<{
  recommendedMm: number;
  actualMm: number | null;
  invalid: boolean;
}>;
```

The cue may render local draft values for explanation, but it must not calculate fit, validate geometry or call commands.

## 6. Single rotate action

There is exactly one focusable `Повернуть 90°` button in the selected-object inspector.

Its visual placement is adjacent to the exact rotation field at ordinary widths and may move into the ordinary action area at compact widths. Responsive CSS must move the same semantic control; it must not render duplicate buttons.

## 7. Review result

Self-review found no placeholders, no new persistent furniture model, no conflict with M2 authority and no expansion into planning, recognition or 3D. The main specification plus this normative companion form the complete approved M7.7 design contract.
