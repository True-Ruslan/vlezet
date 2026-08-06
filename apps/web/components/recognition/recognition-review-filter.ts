import { useSyncExternalStore } from "react";

export type RecognitionReviewFilter =
  | "all"
  | "local"
  | "ai-proposals"
  | "questioned-local";

export const RECOGNITION_REVIEW_FILTERS: readonly Readonly<{
  value: RecognitionReviewFilter;
  label: string;
}>[] = Object.freeze([
  { value: "all", label: "Все источники" },
  { value: "local", label: "Только Local" },
  { value: "ai-proposals", label: "Предложения AI" },
  { value: "questioned-local", label: "Локальные под вопросом" },
]);

let currentFilter: RecognitionReviewFilter = "all";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): RecognitionReviewFilter {
  return currentFilter;
}

export function setRecognitionReviewFilter(filter: RecognitionReviewFilter): void {
  if (currentFilter === filter) return;
  currentFilter = filter;
  listeners.forEach((listener) => listener());
}

export function useRecognitionReviewFilter(): RecognitionReviewFilter {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
