export type FinishProjectStartupOptions = Readonly<{
  persistLastProject: () => Promise<void>;
  showEditor: () => void;
  restoreRecognition: () => Promise<void>;
  onRecognitionError: (cause: unknown) => void;
}>;

/**
 * Makes the core editor visible before optional recognition-session recovery finishes.
 * Recognition restore errors stay isolated from the project startup lifecycle.
 */
export async function finishProjectStartup(options: FinishProjectStartupOptions): Promise<void> {
  await options.persistLastProject();
  options.showEditor();
  try {
    await options.restoreRecognition();
  } catch (cause) {
    options.onRecognitionError(cause);
  }
}
