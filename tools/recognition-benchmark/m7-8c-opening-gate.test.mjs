import assert from "node:assert/strict";
import test from "node:test";
import { verifyM78COpeningGate } from "./m7-8c-opening-gate.mjs";

function result(overrides = {}) {
  return {
    aggregate: {
      metrics: {
        openingF1: { status: "measured", value: 0.9 },
        unknownHostOpenings: { status: "measured", value: 0 },
        staleDecisions: { status: "measured", value: 0 },
        incorrectHighConfidenceRate: { status: "measured", value: 0 },
        ...overrides,
      },
    },
  };
}

test("accepts Core and Source at or above the M7.8C threshold", () => {
  assert.equal(verifyM78COpeningGate([
    { label: "Core", result: result({ openingF1: { status: "measured", value: 0.85 } }) },
    { label: "Source", result: result() },
  ]).length, 2);
});

test("rejects opening F1 below 0.85", () => {
  assert.throws(() => verifyM78COpeningGate([
    { label: "Source", result: result({ openingF1: { status: "measured", value: 0.849 } }) },
  ]), /below 0\.85/);
});

test("rejects any safety regression", () => {
  for (const metric of ["unknownHostOpenings", "staleDecisions", "incorrectHighConfidenceRate"]) {
    assert.throws(() => verifyM78COpeningGate([
      { label: "Core", result: result({ [metric]: { status: "measured", value: 1 } }) },
    ]));
  }
});
