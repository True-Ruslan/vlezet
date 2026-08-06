import assert from "node:assert/strict";
import test from "node:test";

function indexedDbFailure(error, label) {
  const name = error?.name ?? "UnknownError";
  const message = error?.message ? `: ${error.message}` : "";
  return new Error(`${label}: ${name}${message}`);
}

test("WebKit seed diagnostics preserve the originating IndexedDB request error", () => {
  const cause = new DOMException("Key path rejected", "DataError");
  assert.equal(
    indexedDbFailure(cause, "Unable to seed recognition session").message,
    "Unable to seed recognition session: DataError: Key path rejected",
  );
});

export { indexedDbFailure };
