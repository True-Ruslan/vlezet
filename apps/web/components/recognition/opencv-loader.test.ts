import { describe, expect, it, vi } from "vitest";
import { resolveOpenCvModule } from "./opencv-loader";

describe("OpenCV module loader", () => {
  it("does not await a ready Emscripten module merely because it exposes a then property", async () => {
    const fakeModule = {
      Mat: class Mat {},
      then: Promise.prototype.then,
    };

    const result = await resolveOpenCvModule(fakeModule);

    expect(result.cv).toBe(fakeModule);
  });

  it("awaits a genuine Promise export", async () => {
    const fakeModule = { Mat: class Mat {} };

    const result = await resolveOpenCvModule(Promise.resolve(fakeModule));

    expect(result.cv).toBe(fakeModule);
  });

  it("waits for onRuntimeInitialized when the module is not ready yet", async () => {
    const fakeModule: { Mat?: unknown; onRuntimeInitialized?: () => void } = {};
    const settled = vi.fn();

    const pending = resolveOpenCvModule(fakeModule).then((result) => {
      settled();
      return result;
    });

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(fakeModule.onRuntimeInitialized).toBeTypeOf("function");

    fakeModule.Mat = class Mat {};
    fakeModule.onRuntimeInitialized?.();
    const result = await pending;

    expect(result.cv).toBe(fakeModule);
  });
});
