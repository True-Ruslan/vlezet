export * from "./ai-local-evidence";
export type {
  SanitizeAiOpeningProposalInput,
  SanitizedAiOpeningProposal,
} from "./ai-opening-sanitizer";
export { sanitizeAiOpeningProposal } from "./ai-opening-sanitizer-runtime";
export type {
  RecognitionAiProviderIdentity,
  SanitizeAiProposalBatchInput,
  SanitizeAiProposalBatchResult,
} from "./ai-proposal-sanity";
export { sanitizeAiProposalBatch } from "./ai-proposal-sanity-runtime";
export * from "./ai-proposals";
export * from "./ai-rejected-opening-evidence";
export * from "./ai-rejected-opening-evidence-runtime";
export * from "./ai-wall-review-sanitizer";
export * from "./architectural-lines";
export * from "./cloud-sanity";
export type {
  ContinuousDoorHostAnalysisInput,
  ContinuousDoorHostAnalysisResult,
} from "./continuous-door-host-analysis";
export { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
export type {
  DoorHostConsolidationInput,
  DoorHostConsolidationResult,
  DoorHostProposalEvidence,
  DoorOpeningEligibility,
} from "./door-host-consolidation";
export { consolidateDoorHostWalls } from "./door-host-consolidation-runtime";
export * from "./draft-fingerprint";
export { LOCAL_RECOGNITION_ENGINE_VERSION } from "./engine-version";
export {
  analyzeWallCandidates,
  buildWallCandidates,
  createAdaptiveLocalRecognitionOptions,
  DEFAULT_LOCAL_RECOGNITION_OPTIONS,
} from "./local-lines";
export type {
  AdaptiveLocalRecognitionScaleInput,
  BuildWallCandidatesInput,
  DetectedLineSegment,
  LocalRecognitionOptions,
  LocalWallCandidateAnalysis,
} from "./local-lines";
export * from "./model";
export { DEFAULT_OPENING_ANALYSIS_OPTIONS } from "./opening-analysis";
export type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisOptions,
  OpeningAnalysisResult,
  OpeningHypothesisRejection,
  OpeningHypothesisRejectionCode,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
export {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
} from "./opening-analysis-with-ai-evidence";
export * from "./opening-host-rebinding";
export * from "./openings";
export * from "./provider";
export * from "./reconcile";
export * from "./review-budget";
export * from "./review-selection";
export type { SegmentedBoundaryRecoveryResult } from "./segmented-boundary-recovery";
export { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";
export * from "./session";
export * from "./source-scale";
export type {
  StructuralClutterCandidateAnalysis,
  StructuralClutterVetoResult,
} from "./structural-clutter-veto";
export { analyzeStructuralClutterCandidate } from "./structural-clutter-veto";
export { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime";
export * from "./structural-regions";
export * from "./thick-wall-consolidation";
export * from "./thin-structural-recovery";
export * from "./topology-sanity";
export {
  DEFAULT_WALL_COMPLETION_OPTIONS,
  completeWallCenterlines as experimentalCompleteWallCenterlines,
} from "./wall-completion";
export type {
  CompleteWallCenterlinesInput,
  StructuralMaskView,
  WallCompletionDiagnostic,
  WallCompletionDiagnosticCode,
  WallCompletionOptions,
  WallCompletionResult,
} from "./wall-completion";
export { completeWallCenterlines } from "./wall-completion-runtime";
export * from "./wall-evidence-filter";
export * from "./wall-evidence-fusion";
export * from "./wall-topology";
export type { WindowHostConsolidationInput } from "./window-host-consolidation";
export type {
  WindowHostAnnotatedWallCandidate,
  WindowHostConsolidationResult,
  WindowHostProposalEvidence,
} from "./window-host-consolidation-runtime";
export {
  consolidateWindowHostWalls,
  windowHostProposalEvidenceForWall,
  windowHostProposalEvidenceListForWall,
} from "./window-host-consolidation-runtime";
export type { CreateWindowHostOpeningHypothesesInput } from "./window-host-opening-hypotheses";
export { createWindowHostOpeningHypotheses } from "./window-host-opening-hypotheses";
export * from "./window-mask-analysis";