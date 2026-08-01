import { describe, expect, it, vi } from "vitest";
import { createFirstProjectGuideRuntimeStore } from "./first-project-guide-runtime-store";

describe("M7.5 first-project guide runtime store", () => {
  it("loads the browser-local preference for each project", () => {
    const read = vi.fn((projectId: string) => projectId === "p1");
    const store = createFirstProjectGuideRuntimeStore({ read, write: () => true });

    store.getState().load("p1");
    expect(store.getState()).toMatchObject({ projectId: "p1", dismissed: true });

    store.getState().load("p2");
    expect(store.getState()).toMatchObject({ projectId: "p2", dismissed: false });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("hides the guide for the runtime session even when storage rejects the write", () => {
    const write = vi.fn(() => false);
    const store = createFirstProjectGuideRuntimeStore({ read: () => false, write });
    store.getState().load("p1");
    store.getState().dismiss("p1");

    expect(store.getState()).toMatchObject({ projectId: "p1", dismissed: true });
    expect(write).toHaveBeenCalledWith("p1");
  });

  it("ignores a stale dismiss request from another project", () => {
    const write = vi.fn(() => true);
    const store = createFirstProjectGuideRuntimeStore({ read: () => false, write });
    store.getState().load("p2");
    store.getState().dismiss("p1");

    expect(store.getState()).toMatchObject({ projectId: "p2", dismissed: false });
    expect(write).not.toHaveBeenCalled();
  });
});
