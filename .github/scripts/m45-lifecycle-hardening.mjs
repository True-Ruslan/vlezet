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
  'import { ReferencePanel, type ReferenceInstallDraft } from "../reference/reference-panel";',
  'import type { ReferenceInstallDraft } from "../reference/reference-panel";',
  "unused ReferencePanel import",
);

replaceOnce(
`    try {
      await recognitionRepositoryRef.current?.deleteForProject(project.id);
      await repository.delete(project.id);`,
`    try {
      const recognitionRepository = recognitionRepositoryRef.current ?? new IndexedDbRecognitionSessionRepository();
      recognitionRepositoryRef.current = recognitionRepository;
      await recognitionRepository.deleteForProject(project.id);
      await repository.delete(project.id);`,
  "orphan recognition cleanup",
);

replaceOnce(
`    } catch (cause) {
      if (abortController.signal.aborted) throw cause;
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить AI-проверку.";`,
`    } catch (cause) {
      if (abortController.signal.aborted) {
        await controller.replaceDraft(session.draft, session.cloudMetadata);
        return;
      }
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить AI-проверку.";`,
  "cloud cancellation restore",
);

fs.writeFileSync(path, text);
console.log("M4.5 lifecycle hardening applied.");
