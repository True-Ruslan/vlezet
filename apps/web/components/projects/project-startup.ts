export type FinishProjectStartupOptions = Readonly<{
  persistLastProject: () => Promise<void>;
  showEditor: () => void;
  restoreRecognition: () => Promise<void>;
  onRecognitionError: (cause: unknown) => void;
}>;

export async function finishProjectStartup(options: FinishProjectStartupOptions): Promise<void> {
  await options.persistLastProject();
  options.showEditor();
  try {
    await options.restoreRecognition();
  } catch (cause) {
    options.onRecognitionError(cause);
  }
}
