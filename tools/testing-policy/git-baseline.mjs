const FULL_LOWERCASE_SHA = /^[0-9a-f]{40}$/;
const ZERO_SHA = "0000000000000000000000000000000000000000";

export function resolvePolicyBaseSha(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (trimmed === "") return undefined;
  if (!FULL_LOWERCASE_SHA.test(trimmed) || trimmed === ZERO_SHA) {
    throw new Error("POLICY_BASE_SHA must be a full lowercase Git SHA");
  }
  return trimmed;
}

export function requireSuccessfulGit(result, operation) {
  if (!result || typeof result !== "object") {
    throw new Error(`${operation} returned no process result`);
  }
  if (result.error) {
    throw new Error(`${operation} failed to spawn: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`${operation} terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || "no Git error details").trim();
    throw new Error(`${operation} failed with exit code ${result.status}: ${details}`);
  }
  return result;
}

export function classifyBaselineTreeResult(result, baselinePath) {
  requireSuccessfulGit(result, "Git base baseline lookup");
  const output = String(result.stdout ?? "").trim();
  if (output === "") return false;

  const tab = output.indexOf("\t");
  const metadata = tab === -1 ? "" : output.slice(0, tab);
  const path = tab === -1 ? "" : output.slice(tab + 1);
  if (!/^\d{6} blob [0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(metadata)
    || path !== baselinePath) {
    throw new Error(`Git base baseline lookup returned unexpected output: ${output}`);
  }
  return true;
}
