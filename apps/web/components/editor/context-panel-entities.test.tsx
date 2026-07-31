import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wallInspectorSource = readFileSync(new URL("./wall-inspector.tsx", import.meta.url), "utf8");
const objectInspectorSource = readFileSync(new URL("./object-inspector.tsx", import.meta.url), "utf8");

function order(source: string, ...tokens: string[]): number[] {
  return tokens.map((token) => source.indexOf(token));
}

describe("M7.2 entity inspector hierarchy", () => {
  it("uses shared semantic frames for empty, wall, room, opening and object contexts", () => {
    expect(wallInspectorSource).toContain("ContextPanelFrame");
    expect(wallInspectorSource).toContain("describeEmptyContext");
    expect(wallInspectorSource).toContain("describeWallContext");
    expect(wallInspectorSource).toContain("describeRoomContext");
    expect(wallInspectorSource).toContain("describeOpeningContext");
    expect(objectInspectorSource).toContain("ContextPanelFrame");
    expect(objectInspectorSource).toContain("describeObjectContext");
  });

  it("does not use raw IDs as dominant entity headings", () => {
    expect(wallInspectorSource).not.toContain('<div className="inspector-heading"><span>Стена</span><code>');
    expect(wallInspectorSource).not.toContain('<div className="inspector-heading"><span>Комната</span><code>');
    expect(objectInspectorSource).not.toContain('<div className="inspector-heading"><span>Предмет</span><code>');
  });

  it("places undoable opening deletion in a separated danger zone", () => {
    expect(wallInspectorSource).toContain("ContextDangerZone");
    expect(wallInspectorSource).toContain("Можно отменить через «Отменить»");
    const [applyIndex, dangerIndex, deleteIndex] = order(wallInspectorSource, "onClick={apply}", "<ContextDangerZone", "deleteSelectedOpening");
    expect(applyIndex).toBeGreaterThan(-1);
    expect(dangerIndex).toBeGreaterThan(applyIndex);
    expect(deleteIndex).toBeGreaterThan(dangerIndex);
  });

  it("keeps rotate and duplicate ordinary while object deletion is last and undoable", () => {
    expect(objectInspectorSource).toContain("ContextDangerZone");
    expect(objectInspectorSource).toContain("Можно отменить через «Отменить»");
    const [rotateIndex, duplicateIndex, dangerIndex, deleteIndex] = order(
      objectInspectorSource,
      "rotateSelectedObject90",
      "duplicateSelectedObject",
      "<ContextDangerZone",
      "deleteSelectedObject",
    );
    expect(rotateIndex).toBeGreaterThan(-1);
    expect(duplicateIndex).toBeGreaterThan(rotateIndex);
    expect(dangerIndex).toBeGreaterThan(duplicateIndex);
    expect(deleteIndex).toBeGreaterThan(dangerIndex);
  });
});
