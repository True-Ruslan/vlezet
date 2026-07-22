import { describe, expect, it } from "vitest";
import { resolveWallThicknessAlignment } from "./wall-thickness-intent";

describe("wall thickness intent", () => {
  it("keeps the outside face fixed when thickness grows inward", () => {
    expect(resolveWallThicknessAlignment("left", "inside")).toBe("right-face");
    expect(resolveWallThicknessAlignment("right", "inside")).toBe("left-face");
  });

  it("keeps the room face fixed when thickness grows outward", () => {
    expect(resolveWallThicknessAlignment("left", "outside")).toBe("left-face");
    expect(resolveWallThicknessAlignment("right", "outside")).toBe("right-face");
  });

  it("keeps the centreline fixed for centred growth", () => {
    expect(resolveWallThicknessAlignment("left", "center")).toBe("center");
  });
});
