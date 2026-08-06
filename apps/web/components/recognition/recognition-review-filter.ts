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
