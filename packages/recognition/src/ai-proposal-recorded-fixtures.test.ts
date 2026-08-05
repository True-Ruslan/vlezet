import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type RecordedExpectation = Readonly<{
  eligibleDoorsMinimum: number;
  eligibleWindowsMinimum: number;
  eligibleWashbasinAdvisory: boolean;
  eligibleUnknownHostOpenings: number;
  eligibleOutsideHostOpenings: number;
  directLocalMutationCount: number;
  protectedStrongWallAdvisories: number;
  forbiddenRegionEligibleProposals: number;
}>;

type RecordedFixture = Readonly<{
  id: string;
  analogueFixtureId: string;
  mode: "stage1-proposal-discovery";
  responsePath: string;
  expected: RecordedExpectation;
}>;

type RecordedManifest = Readonly<{
  schemaVersion: "recognition-recorded-ai-proposals-v1";
  fixtures: readonly RecordedFixture[];
}>;

type RecordedOpeningProposal = Readonly<{
  id: string;
  kind: "opening-addition";
  openingKind: "door" | "window";
  hostWallHintIds: readonly string[];
}>;

type RecordedWallReviewProposal = Readonly<{
  id: string;
  kind: "local-wall-review";
  targetWallCandidateId: string;
  recommendation: "likely-clutter";
  reasonCodes: readonly string[];
}>;

type RecordedProposal = RecordedOpeningProposal | RecordedWallReviewProposal;

type RecordedBatch = Readonly<{
  schemaVersion: "recognition-ai-proposals-v1";
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  proposals: readonly RecordedProposal[];
  diagnostics: readonly unknown[];
}>;

type RecordedSchema = Readonly<{
  $id: string;
  title: string;
  $defs: Readonly<Record<string, unknown>>;
}>;

const corpusRoot = new URL("../benchmarks/real-analogues/recorded-ai-proposals/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", corpusRoot), "utf8")) as RecordedManifest;
const schema = JSON.parse(readFileSync(new URL("schema.json", corpusRoot), "utf8")) as RecordedSchema;
const fixture = manifest.fixtures[0]!;
const response = JSON.parse(readFileSync(new URL(fixture.responsePath, corpusRoot), "utf8")) as RecordedBatch;

function openingCount(kind: "door" | "window"): number {
  return response.proposals.filter(
    (proposal): proposal is RecordedOpeningProposal => proposal.kind === "opening-addition"
      && proposal.openingKind === kind,
  ).length;
}

function hasWashbasinAdvisory(): boolean {
  return response.proposals.some((proposal) => proposal.kind === "local-wall-review"
    && proposal.recommendation === "likely-clutter"
    && proposal.reasonCodes.includes("sanitary-symbol-overlap"));
}

describe("recorded Stage 1 AI proposal corpus", () => {
  it("pins a public analogue and a versioned response contract without private raster bytes", () => {
    expect(manifest.schemaVersion).toBe("recognition-recorded-ai-proposals-v1");
    expect(manifest.fixtures).toHaveLength(1);
    expect(fixture).toMatchObject({
      id: "product-owner-current-plan-stage1",
      analogueFixtureId: "real-plan-001-anonymized",
      mode: "stage1-proposal-discovery",
      responsePath: "fixtures/product-owner-current-plan-stage1.json",
    });
    expect(schema.$id).toBe("https://vlezet.dev/schemas/recognition-recorded-ai-proposals-v1.json");
    expect(schema.$defs).toHaveProperty("recordedBatch");
    expect(response).toMatchObject({
      schemaVersion: "recognition-ai-proposals-v1",
      requestId: "recorded-product-owner-current-plan-stage1-v1",
      referenceRevision: "real-plan-001-anonymized-v1",
      localDraftFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      diagnostics: [],
    });
    expect(response.proposals.length).toBeLessThanOrEqual(24);

    const committedContract = JSON.stringify({ manifest, response });
    expect(committedContract).not.toMatch(/data:image|base64|private-source|private-raster|\.png|\.jpe?g/i);
  });

  it("requires at least one recovered eligible door", () => {
    expect(openingCount("door")).toBeGreaterThanOrEqual(fixture.expected.eligibleDoorsMinimum);
  });

  it("requires at least one recovered eligible window", () => {
    expect(openingCount("window")).toBeGreaterThanOrEqual(fixture.expected.eligibleWindowsMinimum);
  });

  it("requires an eligible washbasin clutter advisory", () => {
    expect(hasWashbasinAdvisory()).toBe(fixture.expected.eligibleWashbasinAdvisory);
  });

  it("locks every Stage 1 safety counter at zero", () => {
    expect(fixture.expected).toMatchObject({
      eligibleUnknownHostOpenings: 0,
      eligibleOutsideHostOpenings: 0,
      directLocalMutationCount: 0,
      protectedStrongWallAdvisories: 0,
      forbiddenRegionEligibleProposals: 0,
    });
  });
});
