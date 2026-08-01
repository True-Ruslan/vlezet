import { describe, expect, it } from "vitest";
import {
  canvasEntityName,
  parseCanvasEntityName,
  type CanvasEntityIdentity,
} from "./canvas-entity-identity";

describe("M7.4 Canvas entity hit identity", () => {
  it.each<CanvasEntityIdentity>([
    { kind: "room", id: "room-1" },
    { kind: "wall", id: "wall:with:separator" },
    { kind: "opening", id: "opening/1" },
    { kind: "object", id: "object 1" },
  ])("round-trips $kind identity safely", (identity) => {
    expect(parseCanvasEntityName(canvasEntityName(identity.kind, identity.id))).toEqual(identity);
  });

  it("ignores unrelated and malformed Konva names", () => {
    expect(parseCanvasEntityName("room:room-1")).toBeNull();
    expect(parseCanvasEntityName("canvas-entity:unknown:value")).toBeNull();
    expect(parseCanvasEntityName("canvas-entity:wall:%E0%A4%A")).toBeNull();
    expect(parseCanvasEntityName("")).toBeNull();
  });
});
