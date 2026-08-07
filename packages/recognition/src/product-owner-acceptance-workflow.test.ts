import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_OWNER_ACCEPTANCE_CASES,
  createProductOwnerReviewSubmission,
} from "../../../tools/recognition-benchmark/product-owner-acceptance.mjs";

const HEAD = "b".repeat(40);
const SOURCE_SHA = "c9ed200640c13770821947a5d3628e357e7400679dd6bb174e2a52a6c0f2f9ef";
const REVIEWED_AT = "2026-08-07T18:30:00.000Z";

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

function statuses(value: "pass" | "fail" = "pass") {
  return Object.fromEntries(PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => [id, value]));
}

describe("manual product-owner acceptance workflow", () => {
  it("builds an explicit reviewed submission from exactly the six fixed statuses", () => {
    expect(createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: REVIEWED_AT,
      decision: "accept",
      statuses: statuses(),
    })).toEqual({
      schemaVersion: "recognition-product-owner-review-v1",
      commitSha: HEAD,
      batchId: manifest.batchId,
      sourceId: "real-plan-001",
      sourceSha256: SOURCE_SHA,
      reviewedAt: REVIEWED_AT,
      cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => ({ id, status: "pass" })),
      decision: "accept",
    });
  });

  it("rejects missing, extra and not-reviewed submission statuses", () => {
    const missing = statuses();
    delete missing[PRODUCT_OWNER_ACCEPTANCE_CASES[0]!.id];
    expect(() => createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: REVIEWED_AT,
      decision: "accept",
      statuses: missing,
    })).toThrow(/exact required status set/i);

    expect(() => createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: REVIEWED_AT,
      decision: "accept",
      statuses: { ...statuses(), unexpected: "pass" },
    })).toThrow(/exact required status set/i);

    expect(() => createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: REVIEWED_AT,
      decision: "accept",
      statuses: { ...statuses(), [PRODUCT_OWNER_ACCEPTANCE_CASES[0]!.id]: "not-reviewed" },
    })).toThrow(/pass or fail/i);
  });

  it("requires an explicit accept or reject decision and canonical timestamp", () => {
    expect(() => createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: REVIEWED_AT,
      decision: "pending",
      statuses: statuses(),
    })).toThrow(/accept or reject/i);
    expect(() => createProductOwnerReviewSubmission({
      commitSha: HEAD,
      manifest,
      reviewedAt: "today",
      decision: "accept",
      statuses: statuses(),
    })).toThrow(/reviewedAt/i);
  });

  it("keeps the GitHub workflow manual-only and source-raster-free", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/recognition-product-owner-acceptance.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request|schedule):/m);
    expect(workflow).toContain("missed_true_door_recovered");
    expect(workflow).toContain("missed_true_window_recovered");
    expect(workflow).toContain("thin_balcony_wall_recovered");
    expect(workflow).toContain("fixture_symbol_not_wall");
    expect(workflow).toContain("thick_load_bearing_wall_single_axis");
    expect(workflow).toContain("plan_orientation_preserved");
    expect(workflow).toContain("decision:");
    expect(workflow).not.toMatch(/source\.(png|jpe?g)|private\/sources|data:image|base64/i);
  });

  it("publishes and enforces only the sanitized verdict artifact", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/recognition-product-owner-acceptance.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("product-owner-review.json");
    expect(workflow).toContain("product-owner-acceptance.json");
    expect(workflow).toContain("product-owner-acceptance.md");
    expect(workflow).toContain("$GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("Enforce explicit product-owner acceptance");
    expect(workflow).toContain("accepted !== true");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).not.toMatch(/OPENROUTER_API_KEY|Authorization|Bearer/i);
  });
});
