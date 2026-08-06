from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1))

# Atomic recognition planner.
apply_path = "apps/web/components/recognition/recognition-apply.ts"
replace_once(
    apply_path,
    'import {\n  sanitizeRecognitionWallTopology,',
    'import {\n  prepareAtomicRecognitionApply,\n  sanitizeRecognitionWallTopology,',
)
for old, new in [
    ('severity: "warning", message: "Кандидат стены содержит конфликт и не был применён."', 'severity: "error", message: "Кандидат стены содержит конфликт и не был применён."'),
    ('severity: "warning", message: "Слишком короткая стена пропущена."', 'severity: "error", message: "Слишком короткая стена пропущена."'),
    ('severity: "warning", message: "Неизвестный тип проёма нужно сначала классифицировать как дверь или окно."', 'severity: "error", message: "Неизвестный тип проёма нужно сначала классифицировать как дверь или окно."'),
    ('severity: "warning", message: "Для проёма не определена стена."', 'severity: "error", message: "Для проёма не определена стена."'),
    ('severity: "warning", message: "Стена для проёма не была применена или сопоставлена, поэтому проём пропущен."', 'severity: "error", message: "Стена для проёма не была применена или сопоставлена, поэтому проём пропущен."'),
    ('severity: "warning", message: "Не удалось определить ширину проёма."', 'severity: "error", message: "Не удалось определить ширину проёма."'),
    ('severity: "warning",\n          message: "Кандидат перекрывает существующий проём на этой стене и оставлен без применения."', 'severity: "error",\n          message: "Кандидат перекрывает существующий проём на этой стене и оставлен без применения."'),
]:
    replace_once(apply_path, old, new)

replace_once(
    apply_path,
    '''  const topologySanity = sanitizeRecognitionWallTopology({
    widthPx: input.referencePlan.widthPx,
    heightPx: input.referencePlan.heightPx,
    millimetersPerPixel: input.referencePlan.transform.millimetersPerPixel,
    wallCandidates: input.draft.walls,
  });
  const sanitizedById = new Map(topologySanity.walls.map((candidate) => [candidate.id, candidate]));
  const sanitizedDraft: RecognitionDraft = {
    ...input.draft,
    walls: input.draft.walls.map((candidate) => sanitizedById.get(candidate.id) ?? candidate),
  };
  const topologyDiagnostics: RecognitionApplyDiagnostic[] = topologySanity.diagnostics.map((diagnostic) => ({
    candidateId: diagnostic.candidateId ?? "topology",
    severity: diagnostic.severity,
    message: diagnostic.message,
  }));

  const walls = applyWalls(sanitizedDraft, input.referencePlan, input.document, input.idFactory);
  const openings = applyOpenings(sanitizedDraft, input.referencePlan, walls.document, walls.candidateToWallId, input.idFactory);
  return {
    document: openings.document,
    appliedCandidateIds: [...walls.appliedCandidateIds, ...openings.appliedCandidateIds],
    diagnostics: [...topologyDiagnostics, ...walls.diagnostics, ...openings.diagnostics],
  };''',
    '''  const preflight = prepareAtomicRecognitionApply({
    draft: input.draft,
    referencePlan: input.referencePlan,
    document: input.document,
  });
  if (preflight.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      document: input.document,
      appliedCandidateIds: [],
      diagnostics: preflight.diagnostics,
    };
  }

  const topologySanity = sanitizeRecognitionWallTopology({
    widthPx: input.referencePlan.widthPx,
    heightPx: input.referencePlan.heightPx,
    millimetersPerPixel: input.referencePlan.transform.millimetersPerPixel,
    wallCandidates: preflight.applicableDraft.walls,
  });
  const sanitizedById = new Map(topologySanity.walls.map((candidate) => [candidate.id, candidate]));
  const sanitizedDraft: RecognitionDraft = {
    ...preflight.applicableDraft,
    walls: preflight.applicableDraft.walls.map(
      (candidate) => sanitizedById.get(candidate.id) ?? candidate,
    ),
  };
  const topologyDiagnostics: RecognitionApplyDiagnostic[] = topologySanity.diagnostics.map((diagnostic) => ({
    candidateId: diagnostic.candidateId ?? "topology",
    severity: diagnostic.severity,
    message: diagnostic.message,
  }));

  const walls = applyWalls(sanitizedDraft, input.referencePlan, input.document, input.idFactory);
  const openings = applyOpenings(
    sanitizedDraft,
    input.referencePlan,
    walls.document,
    walls.candidateToWallId,
    input.idFactory,
  );
  const diagnostics = [
    ...preflight.diagnostics,
    ...topologyDiagnostics,
    ...walls.diagnostics,
    ...openings.diagnostics,
  ];
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      document: input.document,
      appliedCandidateIds: [],
      diagnostics,
    };
  }

  return {
    document: openings.document,
    appliedCandidateIds: [...walls.appliedCandidateIds, ...openings.appliedCandidateIds],
    diagnostics,
  };''',
)

# Project orchestration.
project_path = "apps/web/components/projects/project-app.tsx"
replace_once(
    project_path,
    'import { runLocalRecognition } from "../recognition/local-recognition-client";\n',
    'import { runLocalRecognition } from "../recognition/local-recognition-client";\nimport { runRecognitionAiProposalDiscovery } from "../recognition/recognition-ai-proposal-workflow";\n',
)
replace_once(
    project_path,
    '  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);\n',
    '  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);\n  const [cloudDialogPurpose, setCloudDialogPurpose] = useState<"verification" | "proposals">("verification");\n',
)
replace_once(
    project_path,
    '  const applyRecognition = async () => {\n',
    '''  const runAiProposalDiscovery = async (request: CloudRecognitionRequest) => {
    const project = activeProjectRef.current;
    const controller = ensureRecognitionController();
    if (!project?.referencePlan || !referenceAsset || !controller.state.session) {
      throw new Error("Сначала выполните локальное распознавание.");
    }
    setCloudDialogOpen(false);
    await runRecognitionAiProposalDiscovery({
      controller,
      credentials: request,
      referencePlan: project.referencePlan,
      sourceAsset: referenceAsset,
      blobToDataUrl,
    });
    if (
      controller.state.kind === "review"
      && controller.state.session?.draft.aiProposalMetadata
    ) {
      showToast("AI-поиск завершён. Проверьте предложения перед применением.");
    }
  };

  const applyRecognition = async () => {
''',
)
replace_once(
    project_path,
    '        onRunCloudRecognition={() => setCloudDialogOpen(true)}\n',
    '''        onRunCloudRecognition={() => {
          setCloudDialogPurpose("verification");
          setCloudDialogOpen(true);
        }}
        onFindAiProposals={() => {
          setCloudDialogPurpose("proposals");
          setCloudDialogOpen(true);
        }}
        aiProposalDiscoveryAvailable={Boolean(activeProject.referencePlan && referenceAsset && recognitionState.session)}
''',
)
replace_once(
    project_path,
    '        busy={recognitionState.kind === "running-cloud"}\n',
    '        busy={recognitionState.kind === "running-cloud" || recognitionState.kind === "running-ai-proposals"}\n',
)
replace_once(
    project_path,
    '''        onClose={() => {
          cloudAbortRef.current?.abort();''',
    '''        onClose={() => {
          if (cloudDialogPurpose === "proposals") recognitionControllerRef.current?.cancelRunning();
          cloudAbortRef.current?.abort();''',
)
replace_once(
    project_path,
    '        onRun={runCloudRecognition}\n',
    '        onRun={cloudDialogPurpose === "proposals" ? runAiProposalDiscovery : runCloudRecognition}\n',
)

# Prop chain into the existing proposal review panel.
editor_path = "apps/web/components/editor/apartment-editor.tsx"
replace_once(
    editor_path,
    '  onRunCloudRecognition: () => void;\n',
    '  onRunCloudRecognition: () => void;\n  onFindAiProposals: () => void;\n  aiProposalDiscoveryAvailable: boolean;\n',
)
replace_once(
    editor_path,
    '      onRunCloud={props.onRunCloudRecognition}\n',
    '      onRunCloud={props.onRunCloudRecognition}\n      onFindAiProposals={props.onFindAiProposals}\n      aiProposalDiscoveryAvailable={props.aiProposalDiscoveryAvailable}\n',
)
