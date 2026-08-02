"use client";

import type { RecognitionDraft } from "@vlezet/recognition";
import { useEffect } from "react";
import {
  runLocalRecognitionEngine,
  type LocalRecognitionEngineDebug,
} from "./local-recognition-engine";
import { runLocalRecognition } from "./local-recognition-client";
import type { MaterializedLocalRecognitionInput } from "./local-recognition-types";

export type RecognitionBenchmarkDebugResult = Readonly<{
  draft: RecognitionDraft;
  debug: LocalRecognitionEngineDebug;
}>;

export type RecognitionBenchmarkHarnessApi = Readonly<{
  runEngine: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
  runEngineDebug: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionBenchmarkDebugResult>;
  runWorker: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
}>;

declare global {
  interface Window {
    __vlezetRecognitionBenchmark?: RecognitionBenchmarkHarnessApi;
  }
}

export function RecognitionBenchmarkHarness() {
  useEffect(() => {
    const api: RecognitionBenchmarkHarnessApi = {
      runEngine: (input) => runLocalRecognitionEngine(input, { createDraftId: () => "benchmark-draft" }),
      runEngineDebug: async (input) => {
        let debug: LocalRecognitionEngineDebug | null = null;
        const draft = await runLocalRecognitionEngine(input, {
          createDraftId: () => "benchmark-draft",
          onDebug: (snapshot) => { debug = snapshot; },
        });
        if (!debug) throw new Error("Recognition engine did not emit a debug snapshot.");
        return { draft, debug };
      },
      runWorker: (input) => runLocalRecognition({
        ...input,
        sourceMillimetersPerPixel: input.sourceMillimetersPerPixel ?? undefined,
      }),
    };
    window.__vlezetRecognitionBenchmark = api;
    return () => {
      if (window.__vlezetRecognitionBenchmark === api) delete window.__vlezetRecognitionBenchmark;
    };
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Recognition Benchmark Harness</h1>
      <p role="status">Ready</p>
      <p>This route exists only for deterministic browser benchmark execution.</p>
    </main>
  );
}
