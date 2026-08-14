import { browserPolicyViolations } from "./browser-policy.mjs";
import { canonicalDocsViolations } from "./docs-policy.mjs";
import { workflowPolicyViolations } from "./workflow-policy.mjs";

if (process.argv.length !== 2) {
  throw new Error("verify:policy static check accepts no arguments");
}

const violations = [
  ...(await browserPolicyViolations()),
  ...(await canonicalDocsViolations()),
  ...(await workflowPolicyViolations()),
];

if (violations.length > 0) {
  throw new Error(`Testing policy static checks failed:\n- ${violations.join("\n- ")}`);
}

console.log("Testing policy static checks passed");
