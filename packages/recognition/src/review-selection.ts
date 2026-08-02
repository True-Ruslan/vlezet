import type {
  RecognitionOpeningCandidate,
  RecognitionRoomLabelCandidate,
  RecognitionWallCandidate,
} from "./model";

export type RecognitionReviewCandidate =
  | RecognitionWallCandidate
  | RecognitionOpeningCandidate
  | RecognitionRoomLabelCandidate;

function isOpeningCandidate(
  candidate: RecognitionReviewCandidate,
): candidate is RecognitionOpeningCandidate {
  return "hostWallCandidateId" in candidate;
}

export function isRecognitionCandidateBulkAcceptable(
  candidate: RecognitionReviewCandidate,
): boolean {
  if (candidate.confidence !== "high") return false;
  if ("conflict" in candidate && candidate.conflict !== null) return false;
  if (!isOpeningCandidate(candidate)) return true;
  return candidate.kind !== "unknown-opening" && candidate.hostWallCandidateId !== null;
}
