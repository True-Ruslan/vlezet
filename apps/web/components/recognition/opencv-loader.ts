export type OpenCvModuleLike = {
  Mat?: unknown;
  onRuntimeInitialized?: () => void;
};

/**
 * OpenCV.js may export either a genuine Promise or an Emscripten Module object.
 * Some Emscripten module objects expose a `then` property without being a real
 * Promise, so they must never be passed through `await`/Promise resolution raw.
 * Returning `{ cv }` also prevents async return-value thenable assimilation.
 */
export async function resolveOpenCvModule<T extends OpenCvModuleLike>(
  cvModule: T | Promise<T>,
): Promise<Readonly<{ cv: T }>> {
  let cv: T;

  if (cvModule instanceof Promise) {
    cv = await cvModule;
  } else {
    cv = cvModule;
    if (!cv.Mat) {
      await new Promise<void>((resolve) => {
        cv.onRuntimeInitialized = resolve;
      });
    }
  }

  return { cv };
}
