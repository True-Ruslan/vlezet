import fs from "node:fs";

const path = "apps/web/components/projects/project-app.tsx";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected snippet: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected unique snippet: ${label}`);
  text = text.slice(0, first) + replacement + text.slice(first + search.length);
}

replaceOnce(
  'import { ProjectDashboard } from "./project-dashboard";\n',
  'import { ProjectDashboard } from "./project-dashboard";\nimport { finishProjectStartup } from "./project-startup";\n',
  "project startup import",
);

replaceOnce(
`    await loadReferenceAsset(project, repository);
    await ensureRecognitionController().restore(project.id, project.referencePlan ? {
      assetId: project.referencePlan.assetId,
      referenceRevision: project.referencePlan.referenceRevision,
    } : null);
    setSelectedRecognitionCandidateId(null);

    const coordinator = new AutosaveCoordinator<VlezetProjectRecord>({`,
`    await loadReferenceAsset(project, repository);
    setSelectedRecognitionCandidateId(null);

    const coordinator = new AutosaveCoordinator<VlezetProjectRecord>({`,
  "early recognition restore",
);

replaceOnce(
`    await repository.setLastProjectId(project.id);
    setError(null);
    setMode("editor");`,
`    await finishProjectStartup({
      persistLastProject: () => repository.setLastProjectId(project.id),
      showEditor: () => {
        setError(null);
        setMode("editor");
      },
      restoreRecognition: () => ensureRecognitionController().restore(project.id, project.referencePlan ? {
        assetId: project.referencePlan.assetId,
        referenceRevision: project.referencePlan.referenceRevision,
      } : null),
      onRecognitionError: (cause) => {
        console.error(cause);
        setRecognitionState({
          kind: "error",
          session: null,
          message: "Не удалось восстановить черновик распознавания. Редактор продолжает работать.",
        });
      },
    });`,
  "startup completion",
);

fs.writeFileSync(path, text);
console.log("M4.5 startup unblock applied.");
