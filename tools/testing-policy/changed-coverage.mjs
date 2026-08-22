import { isAbsolute, relative } from "node:path";

import {
  CRITICAL_CHANGED_THRESHOLDS,
  ORDINARY_CHANGED_THRESHOLDS,
  isCriticalPath,
  isPlaywrightOnlyCoverageExempt,
  isProductionPath,
} from "./config.mjs";

const METRICS = ["lines", "statements", "functions", "branches"];

function normalizeRepositoryPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const root = process.cwd().replaceAll("\\", "/");
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  if (!isAbsolute(normalized)) return normalized.replace(/^\.\//, "");
  return relative(process.cwd(), normalized).replaceAll("\\", "/");
}

function parseDiffPath(line) {
  const value = line.slice(4);
  if (value === "/dev/null") return null;
  if (!value.startsWith("b/")) {
    throw new Error(`Unexpected Git diff destination path: ${value}`);
  }
  return value.slice(2);
}

export function parseChangedLines(diff) {
  if (typeof diff !== "string") throw new TypeError("Git diff must be a string");

  const changed = new Map();
  let file = null;
  let hunk = null;
  for (const line of diff.split("\n")) {
    if (hunk !== null) {
      if (line.startsWith("\\ No newline at end of file")) continue;
      if (line.startsWith("+")) hunk.newRemaining -= 1;
      else if (line.startsWith("-")) hunk.oldRemaining -= 1;
      else if (line.startsWith(" ")) {
        hunk.oldRemaining -= 1;
        hunk.newRemaining -= 1;
      } else {
        throw new Error(`Invalid Git diff hunk content: ${line}`);
      }
      if (hunk.oldRemaining < 0 || hunk.newRemaining < 0) {
        throw new Error(`Git diff hunk contains more lines than declared: ${line}`);
      }
      if (hunk.oldRemaining === 0 && hunk.newRemaining === 0) hunk = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      file = parseDiffPath(line);
      continue;
    }
    if (!line.startsWith("@@ ")) continue;
    if (file === null) throw new Error(`Git diff hunk has no destination file: ${line}`);

    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) throw new Error(`Invalid zero-context Git diff hunk: ${line}`);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const start = Number(match[3]);
    const count = match[4] === undefined ? 1 : Number(match[4]);
    if (!Number.isSafeInteger(oldCount) || oldCount < 0
      || !Number.isSafeInteger(start) || start < 0
      || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid zero-context Git diff range: ${line}`);
    }
    if (count > 0) {
      if (!changed.has(file)) changed.set(file, new Set());
      const lines = changed.get(file);
      for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
    }
    if (oldCount > 0 || count > 0) {
      hunk = { oldRemaining: oldCount, newRemaining: count };
    }
  }
  if (hunk !== null) throw new Error("Git diff ended before the current hunk was complete");
  return changed;
}

function flattenCoverage(coverage) {
  if (Array.isArray(coverage)) return coverage;
  if (!coverage || typeof coverage !== "object") {
    throw new TypeError("Coverage must be an array or object");
  }
  const values = Object.values(coverage);
  if (values.every(Array.isArray)) return values.flat();
  return values;
}

function requireLocation(value, label) {
  const startLine = value?.start?.line;
  const startColumn = value?.start?.column;
  const endLine = value?.end?.line;
  const endColumn = value?.end?.column;
  if (!Number.isSafeInteger(startLine) || startLine < 1
    || !Number.isSafeInteger(startColumn) || startColumn < 0
    || !Number.isSafeInteger(endLine) || endLine < startLine
    || (endColumn !== null && (!Number.isSafeInteger(endColumn) || endColumn < 0))) {
    throw new Error(`Invalid ${label} location`);
  }
  return value;
}

function locationIntersects(location, changedLines) {
  for (const line of changedLines) {
    if (line >= location.start.line && line <= location.end.line) return true;
  }
  return false;
}

function formatLocation(location) {
  const endColumn = location.end.column === null ? "*" : location.end.column;
  return `${location.start.line}:${location.start.column}-${location.end.line}:${endColumn}`;
}

function isEmptyV8Location(location) {
  return location?.start && location?.end
    && Object.keys(location.start).length === 0
    && Object.keys(location.end).length === 0;
}

function requireHit(hit, label) {
  if (!Number.isFinite(hit) || hit < 0) throw new Error(`Invalid ${label} coverage count: ${hit}`);
  return hit;
}

function percentage(covered, total) {
  return total === 0 ? 100 : Math.round((covered * 10_000) / total) / 100;
}

function metric(items) {
  const covered = items.filter(({ hit }) => hit > 0).length;
  const uncovered = [...new Set(
    items.filter(({ hit }) => hit === 0).map(({ location }) => location),
  )];
  return {
    covered,
    total: items.length,
    pct: percentage(covered, items.length),
    uncovered,
  };
}

function collectFileCoverage(file, changedLines) {
  const statements = [];
  const statementsByChangedLine = new Map();
  for (const [id, rawLocation] of Object.entries(file.statementMap ?? {})) {
    const location = requireLocation(rawLocation, `${file.path} statement ${id}`);
    if (!locationIntersects(location, changedLines)) continue;
    const hit = requireHit(file.s?.[id], `${file.path} statement ${id}`);
    statements.push({ hit, location: formatLocation(location) });
    for (const line of changedLines) {
      if (line < location.start.line || line > location.end.line) continue;
      if (!statementsByChangedLine.has(line)) statementsByChangedLine.set(line, []);
      statementsByChangedLine.get(line).push(hit);
    }
  }

  const lines = [...statementsByChangedLine.entries()].map(([line, hits]) => ({
    hit: hits.some((hit) => hit > 0) ? 1 : 0,
    location: String(line),
  }));

  const functions = [];
  for (const [id, entry] of Object.entries(file.fnMap ?? {})) {
    const location = requireLocation(entry?.loc, `${file.path} function ${id}`);
    if (!locationIntersects(location, changedLines)) continue;
    functions.push({
      hit: requireHit(file.f?.[id], `${file.path} function ${id}`),
      location: formatLocation(location),
    });
  }

  const branches = [];
  for (const [id, entry] of Object.entries(file.branchMap ?? {})) {
    const location = requireLocation(entry?.loc, `${file.path} branch ${id}`);
    const armLocations = entry?.locations;
    const hits = file.b?.[id];
    if (!Array.isArray(armLocations) || !Array.isArray(hits)
      || armLocations.length !== hits.length) {
      throw new Error(`Branch ${id} locations and counts do not match in ${file.path}`);
    }
    const allArmsChanged = locationIntersects(location, changedLines);
    armLocations.forEach((rawArmLocation, index) => {
      if (isEmptyV8Location(rawArmLocation) && !allArmsChanged) return;
      const armLocation = isEmptyV8Location(rawArmLocation)
        ? location
        : requireLocation(rawArmLocation, `${file.path} branch ${id} arm ${index}`);
      if (!allArmsChanged && !locationIntersects(armLocation, changedLines)) return;
      branches.push({
        hit: requireHit(hits[index], `${file.path} branch ${id} arm ${index}`),
        location: formatLocation(armLocation),
      });
    });
  }

  return {
    lines: metric(lines),
    statements: metric(statements),
    functions: metric(functions),
    branches: metric(branches),
  };
}

function hasExecutableCoverage(metrics) {
  return METRICS.some((name) => metrics[name].total > 0);
}

function meetsThreshold(actual, required) {
  return BigInt(actual.covered) * 100n >= BigInt(required) * BigInt(actual.total);
}

export function collectChangedCoverage(coverage, changedLines) {
  if (!(changedLines instanceof Map)) throw new TypeError("Changed lines must be a Map");

  const productionChanges = new Map(
    [...changedLines.entries()]
      .map(([file, lines]) => [normalizeRepositoryPath(file), lines])
      .filter(([file]) => isProductionPath(file) && !isPlaywrightOnlyCoverageExempt(file)),
  );
  const coverageByPath = new Map();
  for (const file of flattenCoverage(coverage)) {
    if (!file || typeof file.path !== "string") {
      throw new TypeError("Every Istanbul coverage entry must have a path");
    }
    const path = normalizeRepositoryPath(file.path);
    if (coverageByPath.has(path)) throw new Error(`Duplicate coverage path: ${path}`);
    coverageByPath.set(path, file);
  }

  const files = [];
  for (const [path, lines] of productionChanges) {
    if (!(lines instanceof Set)) throw new TypeError(`Changed lines for ${path} must be a Set`);
    const file = coverageByPath.get(path);
    if (!file) throw new Error(`Missing coverage entry for changed production file: ${path}`);
    const metrics = collectFileCoverage({ ...file, path }, lines);
    if (hasExecutableCoverage(metrics)) files.push({ file: path, metrics });
  }
  return files.sort((left, right) => left.file.localeCompare(right.file));
}

export function checkChangedCoverage(coverage, changedLines) {
  const files = collectChangedCoverage(coverage, changedLines);
  const failures = [];
  for (const { file, metrics } of files) {
    const thresholds = isCriticalPath(file)
      ? CRITICAL_CHANGED_THRESHOLDS
      : ORDINARY_CHANGED_THRESHOLDS;
    for (const name of METRICS) {
      const actual = metrics[name];
      const required = thresholds[name];
      if (actual.total === 0 || meetsThreshold(actual, required)) continue;
      const locations = actual.uncovered.map((location) => `${file}:${location}`).join(", ");
      failures.push(
        `${file} ${name}: actual ${actual.covered}/${actual.total} (${actual.pct.toFixed(2)}%), required ${required.toFixed(2)}%; uncovered executable locations: ${locations}`,
      );
    }
  }
  return { applicable: files.length > 0, files, failures };
}
