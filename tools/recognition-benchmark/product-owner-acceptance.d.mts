export type ProductOwnerAcceptanceCaseId =
  | "missed-true-door-recovered"
  | "missed-true-window-recovered"
  | "thin-balcony-wall-recovered"
  | "fixture-symbol-not-wall"
  | "thick-load-bearing-wall-single-axis"
  | "plan-orientation-preserved";

export type ProductOwnerReviewStatus = "pass" | "fail" | "not-reviewed";
export type ProductOwnerSubmissionStatus = "pass" | "fail";
export type ProductOwnerDecision = "accept" | "reject" | "pending";
export type ProductOwnerSubmissionDecision = "accept" | "reject";

export const PRODUCT_OWNER_ACCEPTANCE_CASES: readonly Readonly<{
  id: ProductOwnerAcceptanceCaseId;
  label: string;
}>[];

export type ProductOwnerReview = Readonly<{
  schemaVersion: "recognition-product-owner-review-v1";
  commitSha: string;
  batchId: string;
  sourceId: string;
  sourceSha256: string;
  reviewedAt: string | null;
  cases: readonly Readonly<{
    id: ProductOwnerAcceptanceCaseId;
    status: ProductOwnerReviewStatus;
  }>[];
  decision: ProductOwnerDecision;
}>;

export type ProductOwnerAcceptanceVerdict = Readonly<{
  schemaVersion: "recognition-product-owner-acceptance-v1";
  reviewSchemaVersion: "recognition-product-owner-review-v1";
  commitSha: string;
  expectedCommitSha: string;
  batchId: string;
  sourceId: string;
  sourceSha256: string;
  reviewedAt: string | null;
  accepted: boolean;
  exactHead: boolean;
  sourceIdentityMatched: true;
  allRequiredCasesPassed: boolean;
  explicitOwnerDecision: ProductOwnerDecision;
  blockers: readonly string[];
  cases: readonly Readonly<{
    id: ProductOwnerAcceptanceCaseId;
    label: string;
    status: ProductOwnerReviewStatus;
  }>[];
}>;

export function createProductOwnerAcceptanceTemplate(input: Readonly<{
  commitSha: string;
  manifest: unknown;
}>): ProductOwnerReview;

export function createProductOwnerReviewSubmission(input: Readonly<{
  commitSha: string;
  manifest: unknown;
  reviewedAt: string;
  decision: string;
  statuses: Readonly<Record<string, unknown>>;
}>): ProductOwnerReview;

export function evaluateProductOwnerAcceptance(
  input: unknown,
  options: Readonly<{ expectedCommitSha: string; manifest: unknown }>,
): ProductOwnerAcceptanceVerdict;

export function renderProductOwnerAcceptanceMarkdown(input: ProductOwnerAcceptanceVerdict): string;
export function runProductOwnerAcceptanceCli(args?: readonly string[]): Promise<void>;
