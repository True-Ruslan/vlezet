import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/product/PRODUCT_VISION.md",
  "docs/product/USER_JOURNEYS.md",
  "docs/product/UX_AUDIT.md",
  "docs/product/UX_BROWSER_EVIDENCE.md",
  "docs/product/INFORMATION_ARCHITECTURE.md",
  "docs/product/INTERACTION_MODEL.md",
  "docs/product/UX_ROADMAP.md",
  "docs/design/DESIGN_SYSTEM.md",
  "docs/design/COMPONENT_INVENTORY.md",
  "docs/design/CONTENT_AND_TERMINOLOGY.md",
  "docs/design/ACCESSIBILITY.md",
  "docs/milestones/m7-0-acceptance.md",
];

const findingFiles = [
  "docs/product/UX_AUDIT.md",
  "docs/product/UX_BROWSER_EVIDENCE.md",
];

const errors = [];
const contents = new Map();

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required M7.0 document: ${file}`);
    continue;
  }

  const content = readFileSync(file, "utf8");
  contents.set(file, content);
  if (/\b(?:TODO|TBD|FIXME)\b/i.test(content)) {
    errors.push(`Unresolved placeholder in ${file}`);
  }
}

const journeys = contents.get("docs/product/USER_JOURNEYS.md") ?? "";
for (let index = 1; index <= 11; index += 1) {
  const id = `J${String(index).padStart(2, "0")}`;
  if (!new RegExp(`^## ${id}\\b`, "m").test(journeys)) {
    errors.push(`Missing journey ${id}`);
  }
}

const roadmap = contents.get("docs/product/UX_ROADMAP.md") ?? "";
const headingPattern = /^## (UX-[A-Z0-9-]+-\d{3})\s*$/gm;
const seen = new Set();
let findingCount = 0;

for (const file of findingFiles) {
  const audit = contents.get(file) ?? "";
  const headings = [...audit.matchAll(headingPattern)];
  findingCount += headings.length;

  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const id = match[1];
    if (seen.has(id)) errors.push(`Duplicate finding id: ${id}`);
    seen.add(id);

    const start = (match.index ?? 0) + match[0].length;
    const end = headings[index + 1]?.index ?? audit.length;
    const block = audit.slice(start, end);
    const requiredFields = [
      "**Severity:**",
      "**Affected journey:**",
      "**Evidence:**",
      "**Root cause:**",
      "**Recommended response:**",
      "**Acceptance criterion:**",
      "**Recommended slice:**",
    ];

    for (const field of requiredFields) {
      if (!block.includes(field)) errors.push(`${id} in ${file} is missing ${field}`);
    }

    const severity = block.match(/\*\*Severity:\*\*\s*(P[0-4])/i)?.[1]?.toUpperCase();
    if (!severity) errors.push(`${id} has no valid severity`);
    if (severity && ["P0", "P1", "P2"].includes(severity) && !roadmap.includes(id)) {
      errors.push(`${id} (${severity}) is not referenced by UX_ROADMAP.md`);
    }
  }
}

if (findingCount === 0) errors.push("M7.0 finding documents contain no structured findings");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`M7.0 documentation contract passed: ${requiredFiles.length} files, ${findingCount} findings.`);
