type RecognitionLogDetails = Readonly<Record<string, string | number | boolean | null | undefined>>;

function isVerboseRecognitionLoggingEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function safeErrorDetails(error: unknown): RecognitionLogDetails {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return { name: error.name, message: error.message, code };
  }
  return { message: String(error) };
}

export function recognitionInfo(event: string, details: RecognitionLogDetails = {}): void {
  if (!isVerboseRecognitionLoggingEnabled()) return;
  console.info(`[Vlezet:RECOGNITION] ${event}`, details);
}

export function recognitionError(event: string, error: unknown, details: RecognitionLogDetails = {}): void {
  console.error(`[Vlezet:RECOGNITION] ${event}`, { ...details, ...safeErrorDetails(error) });
}
