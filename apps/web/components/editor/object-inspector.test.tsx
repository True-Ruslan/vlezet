import type { PlacedObject, VlezetDocument } from "@vlezet/domain";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ObjectInspector } from "./object-inspector";

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

const document: VlezetDocument = {
  schemaVersion: 3,
  vertices: [],
  walls: [],
  openings: [],
  roomAnnotations: [],
  placedObjects: [object],
};

describe("ObjectInspector M7.7 workflow", () => {
  it("prioritises fit, ordinary parameters, use zones and exact position in that order", () => {
    const html = renderToStaticMarkup(<ObjectInspector document={document} object={object} />);
    const fitIndex = html.indexOf("Проверка размещения");
    const mainIndex = html.indexOf("Основные параметры");
    const clearanceIndex = html.indexOf("Зоны использования");
    const positionIndex = html.indexOf("Точное положение");

    expect(fitIndex).toBeGreaterThanOrEqual(0);
    expect(fitIndex).toBeLessThan(mainIndex);
    expect(mainIndex).toBeLessThan(clearanceIndex);
    expect(clearanceIndex).toBeLessThan(positionIndex);
    expect((html.match(/Повернуть 90°/g) ?? [])).toHaveLength(1);
    expect(html).toContain("Применить изменения");
    expect(html).toContain("Рекомендуется");
    expect(html).toContain("Свободно сейчас");
  });

  it("routes one atomic patch through the existing command and resets stale drafts", () => {
    const source = readFileSync(new URL("./object-inspector.tsx", import.meta.url), "utf8");

    expect(source).toContain("parseObjectEditorDraft");
    expect(source).toContain("objectAuthorityFingerprint");
    expect(source).toContain("updateSelectedObject(result.patch)");
    expect(source).not.toContain("parseRequired(");
    expect((source.match(/rotateSelectedObject90\(\)/g) ?? [])).toHaveLength(1);
    expect(source).toContain("authorityFingerprint");
    expect(source).toContain("createObjectEditorDraft(object)");
  });

  it("uses field-local errors and reveals hidden invalid sections before focusing", () => {
    const source = readFileSync(new URL("./object-inspector.tsx", import.meta.url), "utf8");

    expect(source).toContain("aria-invalid");
    expect(source).toContain("aria-describedby");
    expect(source).toContain("setClearanceOpen(true)");
    expect(source).toContain("setPositionOpen(true)");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("firstInvalidField");
  });
});
