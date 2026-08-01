"use client";

import type { RecognitionDraft } from "@vlezet/recognition";
import { useEffect, useState } from "react";
import { runLocalRecognitionEngine } from "./local-recognition-engine";
import { runLocalRecognition } from "./local-recognition-client";
import type { MaterializedLocalRecognitionInput } from "./local-recognition-types";

export type RecognitionBenchmarkHarnessApi = Readonly<{
  runEngine: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
  runWorker: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
}>;

declare global {
  interface Window {
    __vlezetRecognitionBenchmark?: RecognitionBenchmarkHarnessApi;
  }
}

export function RecognitionBenchmarkHarness() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api: RecognitionBenchmarkHarnessApi = {
      runEngine: (input) => runLocalRecognitionEngine(input, { createDraftId: () => "benchmark-draft" }),
      runWorker: (input) => runLocalRecognition(input),
    };
    window.__vlezetRecognitionBenchmark = api;
    setReady(true);
    return () => {
      if (window.__vlezetRecognitionBenchmark === api) delete window.__vlezetRecognitionBenchmark;
    };
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Recognition Benchmark Harness</h1>
      <p role="status">{ready ? "Ready" : "Loading"}</p>
      <p>This route exists only for deterministic browser benchmark execution.</p>
    </main>
  );
}
