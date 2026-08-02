import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const M7_8C_MINIMUM_OPENING_F1 = 0.85;

function measuredMetric(result, name, sourceLabel) {
  const metric = result?.aggregate?.metrics?.[name];
  if (!metric || metric.status !== "measured" || typeof metric.value !== "number" || !Number.isFinite(metric.value)) {
    throw new Error(`${sourceLabel}: aggregate.metrics.${name} must be a finite measured metric.`);
  }
  return metric.value;
}

export function verifyM78COpeningGate(results) {
  if (!Array.isArray(results) || results.length === 0) throw new Error("At least one benchmark result is required.");
  const diagnostics = [];
  for (const entry of results) {
    const label = entry.label ?? "benchmark";
    const openingF1 = measuredMetric(entry.result, "openingF1", label);
    const unknownHosts = measuredMetric(entry.result, "unknownHostOpenings", label);
    const staleDecisions = measuredMetric(entry.result, "staleDecisions", label);
    const incorrectHighConfidence = measuredMetric(entry.result, "incorrectHighConfidenceRate", label);
    diagnostics.push({ label, openingF1, unknownHosts, staleDecisions, incorrectHighConfidence });
    if (openingF1 < M7_8C_MINIMUM_OPENING_F1) throw new Error(`${label}: Opening F1 ${openingF1.toFixed(6)} is below 0.85.`);
    if (unknownHosts !== 0) throw new Error(`${label}: unknown-host openings must be 0, received ${unknownHosts}.`);
    if (staleDecisions !== 0) throw new Error(`${label}: stale decisions must be 0, received ${staleDecisions}.`);
    if (incorrectHighConfidence !== 0) throw new Error(`${label}: incorrect high-confidence rate must be 0, received ${incorrectHighConfidence}.`);
  }
  return diagnostics;
}

async function main(argv) {
  const paths = argv.slice(2);
  if (paths.length === 0 || paths.length > 2) throw new Error("Usage: node m7-8c-opening-gate.mjs <core-result.json> [source-result.json]");
  const labels = paths.length === 1 ? ["Core"] : ["Core", "Source"];
  const verified = verifyM78COpeningGate(await Promise.all(paths.map(async (path, index) => ({ label: labels[index], result: JSON.parse(await readFile(path, "utf8")) }))));
  for (const result of verified) console.log(`${result.label}: Opening F1=${result.openingF1.toFixed(6)}, unknown-host=${result.unknownHosts}, stale=${result.staleDecisions}, incorrect-high-confidence=${result.incorrectHighConfidence}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
