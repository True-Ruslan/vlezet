import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PRODUCT_OWNER_ACCEPTANCE_CASES,
  createProductOwnerAcceptanceTemplate,
  evaluateProductOwnerAcceptance,
  renderProductOwnerAcceptanceMarkdown,
  runProductOwnerAcceptanceCli,
} from "../../../tools/recognition-benchmark/product-owner-acceptance.mjs";

const temporaryRoots: string[] = [];
const HEAD = "b".repeat(40);
const SOURCE_SHA = "c9ed200640c13770821947a5d3628e357e7400679dd6bb174e2a52a6c0f2f9ef";

const manifest = {
  schemaVersion: "recognition-private-source-manifest-v1",
  batchId: "product-owner-real-plans-2026-08-04",
  sources: [{
    sourceId: "real-plan-001",
    sha256: SOURCE_SHA,
    widthPx: 1177,
    heightPx: 884,
    mediaType: "image/jpeg",
    tags: ["current-regression"],
    annotationStatus: "registered",
    redistribution: "not-committed",
  }],
};

function completedReview(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-product-owner-review-v1",
    commitSha: HEAD,
    batchId: manifest.batchId,
    sourceId: "real-plan-001",
    sourceSha256: SOURCE_SHA,
    reviewedAt: "2026-08-07T18:00:00.000Z",
    cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => ({ id, status: "pass" })),
    decision: "accept",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("product-owner original-plan acceptance evidence", () => {
  it("creates a privacy-safe pending template anchored to the registered current-regression source", () => {
    const template = createProductOwnerAcceptanceTemplate({
      commitSha: HEAD,
      manifest,
    });

    expect(template).toEqual({
      schemaVersion: "recognition-product-owner-review-v1",
      commitSha: HEAD,
      batchId: manifest.batchId,
      sourceId: "real-plan-001",
      sourceSha256: SOURCE_SHA,
      reviewedAt: null,
      cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => ({ id, status: "not-reviewed" })),
      decision: "pending",
    });
    expect(JSON.stringify(template)).not.toMatch(/data:image|base64|coordinate|screenshot|note|name|email/i);
  });

  it("accepts only explicit owner acceptance when every required case passes on the exact head", () => {
    const result = evaluateProductOwnerAcceptance(completedReview(), {
      expectedCommitSha: HEAD,
      manifest,
    });

    expect(result).toMatchObject({
      schemaVersion: "recognition-product-owner-acceptance-v1",
      accepted: true,
      exactHead: true,
      sourceIdentityMatched: true,
      allRequiredCasesPassed: true,
      explicitOwnerDecision: "accept",
      blockers: [],
    });
    expect(result.cases).toHaveLength(PRODUCT_OWNER_ACCEPTANCE_CASES.length);
  });

  it("blocks stale heads, pending cases and any failed case", () => {
    const stale = evaluateProductOwnerAcceptance(completedReview(), {
      expectedCommitSha: "c".repeat(40),
      manifest,
    });
    expect(stale.accepted).toBe(false);
    expect(stale.blockers.join("\n")).toMatch(/exact head/i);

    const pendingCases = completedReview({
      cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }, index) => ({
        id,
        status: index === 0 ? "not-reviewed" : "pass",
      })),
      decision: "pending",
    });
    const pending = evaluateProductOwnerAcceptance(pendingCases, { expectedCommitSha: HEAD, manifest });
    expect(pending.accepted).toBe(false);
    expect(pending.blockers.join("\n")).toMatch(/not reviewed|explicit owner decision/i);

    const failedCases = completedReview({
      cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }, index) => ({
        id,
        status: index === 1 ? "fail" : "pass",
      })),
      decision: "reject",
    });
    const failed = evaluateProductOwnerAcceptance(failedCases, { expectedCommitSha: HEAD, manifest });
    expect(failed.accepted).toBe(false);
    expect(failed.blockers.join("\n")).toMatch(/failed/i);
  });

  it("requires the historical door, window, thin-wall, false-wall, thick-wall and orientation checks exactly once", () => {
    expect(PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => id)).toEqual([
      "missed-true-door-recovered",
      "missed-true-window-recovered",
      "thin-balcony-wall-recovered",
      "fixture-symbol-not-wall",
      "thick-load-bearing-wall-single-axis",
      "plan-orientation-preserved",
    ]);

    const duplicate = completedReview();
    duplicate.cases = [...duplicate.cases, { ...duplicate.cases[0] }];
    expect(() => evaluateProductOwnerAcceptance(duplicate, { expectedCommitSha: HEAD, manifest })).toThrow(/duplicate case/i);

    const missing = completedReview();
    missing.cases = missing.cases.slice(1);
    expect(() => evaluateProductOwnerAcceptance(missing, { expectedCommitSha: HEAD, manifest })).toThrow(/required case set/i);
  });

  it("rejects source mismatches, invalid timestamps and privacy-unsafe extra fields", () => {
    expect(() => evaluateProductOwnerAcceptance(completedReview({ sourceSha256: "d".repeat(64) }), {
      expectedCommitSha: HEAD,
      manifest,
    })).toThrow(/source sha/i);
    expect(() => evaluateProductOwnerAcceptance(completedReview({ reviewedAt: "yesterday" }), {
      expectedCommitSha: HEAD,
      manifest,
    })).toThrow(/reviewedAt/i);
    expect(() => evaluateProductOwnerAcceptance({
      ...completedReview(),
      screenshotDataUrl: "data:image/png;base64,PRIVATE",
    }, {
      expectedCommitSha: HEAD,
      manifest,
    })).toThrow(/unsupported field/i);
  });

  it("renders only the sanitized fixed review result and never raw/private source material", () => {
    const result = evaluateProductOwnerAcceptance(completedReview(), {
      expectedCommitSha: HEAD,
      manifest,
    });
    const markdown = renderProductOwnerAcceptanceMarkdown(result);

    expect(markdown).toContain("# Vlezet product-owner recognition acceptance");
    expect(markdown).toContain("ACCEPTED");
    expect(markdown).toContain(HEAD);
    for (const item of PRODUCT_OWNER_ACCEPTANCE_CASES) expect(markdown).toContain(item.label);
    expect(markdown).not.toMatch(/data:image|base64|screenshot|coordinate|Authorization|Bearer|sk-or-v1-/i);
  });

  it("CLI generates a template and evaluates a completed review into JSON plus Markdown", async () => {
    const root = await mkdtemp(join(tmpdir(), "vlezet-owner-review-"));
    temporaryRoots.push(root);
    const manifestPath = join(root, "manifest.json");
    const templatePath = join(root, "review.json");
    const verdictPath = join(root, "verdict.json");
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

    await runProductOwnerAcceptanceCli(["template", HEAD, templatePath, manifestPath]);
    const template = JSON.parse(await readFile(templatePath, "utf8"));
    expect(template.decision).toBe("pending");

    await writeFile(templatePath, JSON.stringify(completedReview()), "utf8");
    await runProductOwnerAcceptanceCli(["evaluate", templatePath, HEAD, verdictPath, manifestPath]);
    expect(JSON.parse(await readFile(verdictPath, "utf8"))).toMatchObject({ accepted: true, exactHead: true });
    expect(await readFile(join(root, "verdict.md"), "utf8")).toContain("ACCEPTED");
  });
});
