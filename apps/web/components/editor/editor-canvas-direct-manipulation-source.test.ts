import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const canvasSource = fs.readFileSync(path.resolve(__dirname, "editor-canvas.tsx"), "utf8");
const shapeSource = fs.readFileSync(path.resolve(__dirname, "placed-object-shape.tsx"), "utf8");

describe("M8.2 direct manipulation Canvas routing", () => {
  it("delegates an already selected furniture body to the semantic room-composite gesture", () => {
    expect(canvasSource).toContain("resolveEditorPointerGestureIntent");
    expect(canvasSource).toContain('kind: "placed-object-body"');
    expect(canvasSource).toContain('moveGestureOwner={moveIntent.kind === "room-composite-move" ? "room-composite" : "object"}');
    expect(canvasSource).toContain("onRoomCompositePointerDown");
  });

  it("prevents the delegated furniture body from starting its independent Konva drag", () => {
    expect(shapeSource).toContain('moveGestureOwner?: "object" | "room-composite"');
    expect(shapeSource).toContain("onRoomCompositePointerDown?");
    expect(shapeSource).toContain('draggable={!preview && moveGestureOwner !== "room-composite"}');
    expect(shapeSource).toContain('if (moveGestureOwner === "room-composite")');
  });

  it("routes door and window bodies through one hosted-opening structural gesture", () => {
    expect(canvasSource).toContain('kind: "translate-opening"');
    expect(canvasSource).toContain("beginStructuralOpeningGesture");
    expect(canvasSource).toContain("previewStructuralOpeningGesture");
    expect(canvasSource).toContain("beginHostedOpeningPointerGesture(opening.id, event)");
    expect(canvasSource.match(/onMouseDown=\{\(event\) => beginHostedOpeningPointerGesture\(opening\.id, event\)\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(canvasSource.match(/onTouchStart=\{\(event\) => beginHostedOpeningPointerGesture\(opening\.id, event\)\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
