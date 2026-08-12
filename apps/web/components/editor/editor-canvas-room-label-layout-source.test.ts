import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("room Canvas label layout integration", () => {
  it("derives a safe screen-space label box and uses the deterministic layout helper", () => {
    expect(source).toContain('import { deriveRoomCanvasLabelLayout } from "./room-canvas-label-layout";');
    expect(source).toContain("deriveRoomCanvasLabelLayout({");
    expect(source).toContain("widthPx: roomScreenBounds.maxX - roomScreenBounds.minX");
    expect(source).toContain("heightPx: roomScreenBounds.maxY - roomScreenBounds.minY");
  });

  it("renders room name, area and dimensions in separate fixed slots", () => {
    expect(source).toContain('key={`label-name-${room.id}`}');
    expect(source).toContain('key={`label-area-${room.id}`}');
    expect(source).toContain('key={`label-dimensions-${room.id}`}');
    expect(source).toContain("height={layout.nameBox.height}");
    expect(source).toContain("ellipsis");
  });

  it("does not use the legacy single auto-wrapping room label block", () => {
    const roomLabelRenderStart = source.indexOf("derivedRooms.rooms.map((room) => {");
    const wallRenderStart = source.indexOf("resolvedWalls.flatMap", roomLabelRenderStart);
    const renderSection = source.slice(roomLabelRenderStart, wallRenderStart);
    expect(renderSection).not.toContain("formatRoomCanvasLabel(room)");
  });
});
