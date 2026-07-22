import { describe, expect, it, vi } from "vitest";
import { finishProjectStartup } from "./project-startup";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

describe("project startup", () => {
  it("shows the editor before optional recognition restore finishes", async () => {
    const recognition = deferred<void>();
    const showEditor = vi.fn();

    const startup = finishProjectStartup({
      persistLastProject: async () => undefined,
      showEditor,
      restoreRecognition: () => recognition.promise,
      onRecognitionError: vi.fn(),
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(showEditor).toHaveBeenCalledOnce();

    recognition.resolve();
    await startup;
  });

  it("keeps the editor open when recognition restore fails", async () => {
    const showEditor = vi.fn();
    const onRecognitionError = vi.fn();

    await finishProjectStartup({
      persistLastProject: async () => undefined,
      showEditor,
      restoreRecognition: async () => { throw new Error("recognition storage failed"); },
      onRecognitionError,
    });

    expect(showEditor).toHaveBeenCalledOnce();
    expect(onRecognitionError).toHaveBeenCalledOnce();
  });
});
