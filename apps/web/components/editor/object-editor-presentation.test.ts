import type { PlacedObject } from "@vlezet/domain";
import type { FitDiagnostic } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  createObjectEditorDraft,
  groupFitDiagnostics,
  objectAuthorityFingerprint,
  parseObjectEditorDraft,
} from "./object-editor-presentation";

const object: PlacedObject = {
  id: "object-1",
  presetId: "desk",
  name: "Рабочий стол",
  category: "table",
  position: { x: 1200, y: 900 },
  width: 1400,
  depth: 700,
  height: 750,
  rotationDeg: 90,
  clearance: { front: 800, right: 0, back: 0, left: 0 },
};

describe("object editor presentation", () => {
  it("reports every locally detectable field error in one submit", () => {
    const result = parseObjectEditorDraft({
      ...createObjectEditorDraft(object),
      name: "   ",
      width: "0",
      depth: "abc",
      height: "-1",
      rotation: "",
      x: " ",
      front: "-10",
      right: "NaN",
      back: "",
    }, object);

    expect(result).toEqual({
      ok: false,
      errors: expect.objectContaining({
        name: "Введите название предмета",
        width: "Введите ширину больше 0 мм",
        depth: "Введите число",
        height: "Введите высоту больше 0 мм",
        rotation: "Введите число",
        x: "Введите число",
        front: "Введите неотрицательный зазор",
        right: "Введите число",
        back: "Введите число",
      }),
    });
  });

  it("accepts decimal comma and preserves height when the draft is empty", () => {
    const result = parseObjectEditorDraft({
      ...createObjectEditorDraft(object),
      width: "1200,5",
      height: "",
    }, object);

    expect(result).toMatchObject({ ok: true, patch: { width: 1200.5 } });
    expect(result.ok && "height" in result.patch).toBe(false);
  });

  it("creates stable drafts and fingerprints all authoritative editable values", () => {
    expect(createObjectEditorDraft(object)).toEqual({
      name: "Рабочий стол",
      width: "1400",
      depth: "700",
      height: "750",
      rotation: "90",
      x: "1200",
      y: "900",
      front: "800",
      right: "0",
      back: "0",
      left: "0",
    });
    expect(objectAuthorityFingerprint(object)).not.toBe(objectAuthorityFingerprint({
      ...object,
      clearance: { ...object.clearance, left: 1 },
    }));
  });

  it("groups existing diagnostics in hard-to-soft order and never drops unknown codes", () => {
    const diagnostics: readonly FitDiagnostic[] = [
      { code: "clearance-wall", severity: "recommendation", objectId: object.id, message: "clearance" },
      { code: "door-obstructed", severity: "collision", objectId: object.id, message: "door" },
      { code: "object-collision", severity: "collision", objectId: object.id, message: "object" },
      { code: "outside-room", severity: "collision", objectId: object.id, message: "outside" },
      { code: "future-code" as FitDiagnostic["code"], severity: "collision", objectId: object.id, message: "future" },
    ];

    const groups = groupFitDiagnostics(diagnostics);

    expect(groups.map((group) => group.id)).toEqual(["containment", "collision", "opening", "clearance"]);
    expect(groups[0]?.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(["outside", "future"]);
    expect(groups.flatMap((group) => group.diagnostics)).toHaveLength(diagnostics.length);
  });
});
