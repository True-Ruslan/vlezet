import { describe, expect, it } from "vitest";
import { createProject, updateReferencePlanDisplay, validateReferencePlan } from "./project";

const legacyReference = {
  assetId: "asset-1",
  source: { kind: "image", originalMimeType: "image/png" },
  widthPx: 1000,
  heightPx: 800,
  transform: { originWorld: { x: 0, y: 0 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: {
    pointA: { x: 100, y: 100 },
    pointB: { x: 600, y: 100 },
    knownLengthMm: 1000,
    alignment: "horizontal",
  },
  display: { visible: true, opacity: 0.45, locked: true },
} as const;

describe("reference revision", () => {
  it("derives the same deterministic revision for identical legacy references", () => {
    const first = validateReferencePlan(legacyReference);
    const second = validateReferencePlan(structuredClone(legacyReference));
    expect(first.referenceRevision).toMatch(/^legacy-/);
    expect(second.referenceRevision).toBe(first.referenceRevision);
  });

  it("preserves revision for display-only changes", () => {
    const referencePlan = validateReferencePlan({ ...legacyReference, referenceRevision: "revision-1" });
    const project = createProject({ id: "project-1", name: "Квартира", now: "2026-07-22T00:00:00.000Z", referencePlan });
    const updated = updateReferencePlanDisplay(project, { opacity: 0.7, visible: false }, "2026-07-22T00:01:00.000Z");
    expect(updated.referencePlan?.referenceRevision).toBe("revision-1");
  });
});
