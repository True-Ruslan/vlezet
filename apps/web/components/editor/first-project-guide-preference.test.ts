import { describe, expect, it, vi } from "vitest";
import {
  firstProjectGuideStorageKey,
  readFirstProjectGuideDismissed,
  writeFirstProjectGuideDismissed,
} from "./first-project-guide-preference";

describe("M7.5 first-project guide preference", () => {
  it("uses a versioned project-scoped key", () => {
    expect(firstProjectGuideStorageKey("project-1")).toBe("vlezet.ui.first-project-guide.v1.project-1");
    expect(firstProjectGuideStorageKey("project-2")).not.toBe(firstProjectGuideStorageKey("project-1"));
  });

  it("reads only the explicit dismissed value", () => {
    expect(readFirstProjectGuideDismissed("p1", { getItem: () => '{"dismissed":true}' })).toBe(true);
    expect(readFirstProjectGuideDismissed("p1", { getItem: () => '{"dismissed":false}' })).toBe(false);
    expect(readFirstProjectGuideDismissed("p1", { getItem: () => "broken" })).toBe(false);
    expect(readFirstProjectGuideDismissed("p1", { getItem: () => null })).toBe(false);
  });

  it("fails open when storage reads are unavailable", () => {
    expect(readFirstProjectGuideDismissed("p1", null)).toBe(false);
    expect(readFirstProjectGuideDismissed("p1", { getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });

  it("writes exactly the dismissal payload and reports failures", () => {
    const setItem = vi.fn();
    expect(writeFirstProjectGuideDismissed("p1", { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      "vlezet.ui.first-project-guide.v1.p1",
      '{"dismissed":true}',
    );
    expect(writeFirstProjectGuideDismissed("p1", null)).toBe(false);
    expect(writeFirstProjectGuideDismissed("p1", { setItem: () => { throw new Error("quota"); } })).toBe(false);
  });

  it("rejects empty project identities without touching storage", () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    expect(readFirstProjectGuideDismissed("", { getItem })).toBe(false);
    expect(writeFirstProjectGuideDismissed("", { setItem })).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
