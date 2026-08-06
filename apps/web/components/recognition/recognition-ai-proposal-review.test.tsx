import {
  AI_PROPOSAL_SCHEMA_VERSION,
  createLocalDraftFingerprint,
  validateRecognitionDraft,
  type RecognitionDraft,
  type RecognitionSessionRecord,
  type SanitizedRecognitionProposal,
} from "@vlezet/recognition";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecognitionPanel } from "./recognition-panel";

const now = "2026-08-06T06:00:00.000Z";

const localDraft: RecognitionDraft = {
  id: "draft-1",
  projectId: "project-1",
  referenceAssetId: "asset-1",
  referenceRevision: "revision-1",
  engineVersion: "5",
  status: "local-complete",
  walls: [{
    id: "wall-1",
    start: { x: 0.1, y: 0.4 },
    end: { x: 0.9, y: 0.4 },
    estimatedThicknessPx: 18,
    confidence: "medium",
    evidence: { localScore: 0.76, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  }, {
    id: "wall-2",
    start: { x: 0.2, y: 0.7 },
    end: { x: 0.8, y: 0.7 },
    estimatedThicknessPx: 16,
    confidence: "high",
    evidence: { localScore: 0.91, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  }],
  openings: [{
    id: "opening-local",
    kind: "door",
    hostWallCandidateId: "wall-2",
    center: { x: 0.5, y: 0.7 },
    widthPx: 82,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.73,
      cloudScore: null,
      reasons: ["wall-gap", "door-arc-like-line", "host-wall-validated"],
    },
    origin: "local",
    conflict: null,
  }],
  roomLabels: [],
  diagnostics: [],
  decisions: { "wall-1": "pending", "wall-2": "pending", "opening-local": "pending" },
  source: { local: true, cloud: false },
  aiProposals: [],
  proposalDecisions: {},
  aiProposalMetadata: null,
  createdAt: now,
  updatedAt: now,
};

const fingerprint = createLocalDraftFingerprint(localDraft);
const provider = {
  providerId: "openrouter",
  modelId: "vision/model-reviewed",
  requestId: "request-1",
} as const;

function proposal(
  value: Omit<SanitizedRecognitionProposal, "provider" | "localDraftFingerprint" | "sourceRegion">,
): SanitizedRecognitionProposal {
  return {
    ...value,
    provider,
    localDraftFingerprint: fingerprint,
    sourceRegion: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
  };
}

const proposals: readonly SanitizedRecognitionProposal[] = [
  proposal({
    id: "proposal-door",
    rawProposalId: "door-raw",
    kind: "door",
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.42, y: 0.4 },
      widthNormalized: 0.08,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: "wall-1",
    modelConfidence: 0.87,
    deterministicConfidence: "medium",
    evidence: {
      providerReasons: ["visible-gap", "door-arc"],
      validatorReasons: ["local-rejected-door-evidence-matched", "structural-gap-validated"],
    },
  }),
  proposal({
    id: "proposal-window-blocked",
    rawProposalId: "window-raw",
    kind: "window",
    state: "blocked",
    geometry: null,
    targetLocalCandidateId: null,
    hostWallCandidateId: null,
    modelConfidence: 0.96,
    deterministicConfidence: "low",
    evidence: {
      providerReasons: ["visible-gap", "parallel-window-rails"],
      validatorReasons: ["missing-host-wall"],
    },
  }),
  proposal({
    id: "proposal-door-duplicate",
    rawProposalId: "duplicate-raw",
    kind: "door",
    state: "duplicate",
    geometry: null,
    targetLocalCandidateId: null,
    hostWallCandidateId: "wall-2",
    modelConfidence: 0.89,
    deterministicConfidence: "low",
    evidence: {
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: ["opening-overlap-existing"],
    },
  }),
  proposal({
    id: "proposal-wall-review",
    rawProposalId: "wall-review-raw",
    kind: "local-wall-review",
    state: "eligible",
    geometry: null,
    targetLocalCandidateId: "wall-1",
    hostWallCandidateId: null,
    modelConfidence: 0.78,
    deterministicConfidence: "low",
    evidence: {
      providerReasons: ["sanitary-symbol-overlap", "weak-structural-mask-support"],
      validatorReasons: ["exact-local-wall-target-validated", "structural-clutter-veto-passed"],
    },
  }),
];

const proposalDraft: RecognitionDraft = {
  ...localDraft,
  aiProposals: proposals,
  proposalDecisions: {
    "proposal-door": "pending",
    "proposal-wall-review": "pending",
  },
  aiProposalMetadata: {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: provider.requestId,
    referenceRevision: localDraft.referenceRevision,
    localDraftFingerprint: fingerprint,
    providerId: provider.providerId,
    modelId: provider.modelId,
    completedAt: now,
  },
};

function session(draft: RecognitionDraft): RecognitionSessionRecord {
  const validated = validateRecognitionDraft(draft);
  return {
    id: "session-1",
    projectId: validated.projectId,
    referenceAssetId: validated.referenceAssetId,
    referenceRevision: validated.referenceRevision,
    engineVersion: validated.engineVersion,
    draft: validated,
    cloudMetadata: null,
    createdAt: now,
    updatedAt: validated.updatedAt,
  };
}

const callbacks = {
  selectedCandidateId: null,
  hasReferencePlan: true,
  missingReferenceAsset: false,
  navigation: { label: "К комнате", onActivate: () => undefined },
  onStartLocal: () => undefined,
  onSelect: () => undefined,
  onDecision: () => undefined,
  onReclassifyOpening: () => undefined,
  onAcceptHighConfidence: () => undefined,
  onRunCloud: () => undefined,
  onFindAiProposals: () => undefined,
  aiProposalDiscoveryAvailable: true,
  onProposalDecision: () => undefined,
  onAgreeWithWallAdvisory: () => undefined,
  onApply: () => undefined,
  onDiscard: () => undefined,
} as const;

function render(filter: "all" | "local" | "ai-proposals" | "questioned-local" = "all") {
  return renderToStaticMarkup(
    <RecognitionPanel
      state={{ kind: "review", session: session(proposalDraft) }}
      reviewFilter={filter}
      onReviewFilterChange={() => undefined}
      {...callbacks}
    />,
  );
}

function taggedBlock(markup: string, marker: string, nextMarker = "data-proposal-kind"): string {
  const start = markup.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = markup.indexOf(nextMarker, start + marker.length);
  return markup.slice(start, next < 0 ? markup.length : next);
}

function occurrences(markup: string, marker: string): number {
  return markup.split(marker).length - 1;
}

describe("transparent AI proposal review", () => {
  it("distinguishes immutable verification from omission discovery", () => {
    const markup = render();
    expect(markup).toContain("Проверить локальный черновик с AI");
    expect(markup).toContain("Найти пропущенные двери и окна с AI");
  });

  it("offers all four source filters and separates provider from deterministic confidence", () => {
    const markup = render();
    expect(markup).toContain('role="group"');
    expect(markup).toContain("Все источники");
    expect(markup).toContain("Только Local");
    expect(markup).toContain("Предложения AI");
    expect(markup).toContain("Локальные под вопросом");
    expect(markup).toContain("OpenRouter · vision/model-reviewed");
    expect(markup).toContain("Уверенность модели: 87%");
    expect(markup).toContain("Детерминированная проверка: Средняя");
  });

  it("explains an eligible opening and exposes explicit decisions", () => {
    const card = taggedBlock(render(), 'data-proposal-kind="door" data-proposal-state="eligible"');
    expect(card).toContain("Дверь · Предложение AI");
    expect(card).toContain("Стена-хозяин подтверждена");
    expect(card).toContain("AI видит разрыв");
    expect(card).toContain("Локальный отклонённый признак двери подтверждён");
    expect(card).toContain("Принять предложение");
    expect(card).toContain("Отклонить предложение");
  });

  it("shows the exact blocker and never offers Accept for a blocked proposal", () => {
    const card = taggedBlock(render(), 'data-proposal-kind="window" data-proposal-state="blocked"');
    expect(card).toContain("Заблокировано проверкой");
    expect(card).toContain("Не найдена однозначная стена-хозяин");
    expect(card).toContain("missing-host-wall");
    expect(card).not.toContain("Принять предложение");
  });

  it("explains duplicates and never renders them as acceptable geometry", () => {
    const card = taggedBlock(render(), 'data-proposal-kind="door" data-proposal-state="duplicate"');
    expect(card).toContain("Такая геометрия уже есть в локальном черновике");
    expect(card).toContain("opening-overlap-existing");
    expect(card).not.toContain("Принять предложение");
  });

  it("uses the approved false-wall advisory wording and exact action", () => {
    const card = taggedBlock(render(), 'data-proposal-kind="local-wall-review" data-proposal-state="eligible"');
    expect(card).toContain("AI считает эту локальную линию вероятным обозначением сантехники или мебели. Согласие отклонит только кандидат локального черновика и не удалит уже существующую стену квартиры.");
    expect(card).toContain("Согласиться и отклонить только локальный кандидат");
    expect(card).toContain("Оставить локальный кандидат");
  });

  it("filters local, proposal and questioned-local review surfaces deterministically", () => {
    const local = render("local");
    expect(occurrences(local, 'data-local-candidate-kind="wall"')).toBe(2);
    expect(occurrences(local, 'data-local-candidate-kind="opening"')).toBe(1);
    expect(local).not.toContain("data-proposal-kind");

    const ai = render("ai-proposals");
    expect(ai).not.toContain("data-local-candidate-kind");
    expect(ai).toContain('data-proposal-kind="door" data-proposal-state="eligible"');

    const questioned = render("questioned-local");
    expect(occurrences(questioned, 'data-local-candidate-kind="wall"')).toBe(1);
    expect(questioned).not.toContain('data-local-candidate-kind="opening"');
    expect(questioned).toContain('data-proposal-kind="local-wall-review" data-proposal-state="eligible"');
  });

  it("keeps local candidate presentation byte-equivalent and does not expose internal IDs", () => {
    const withoutProposals = renderToStaticMarkup(
      <RecognitionPanel
        state={{ kind: "review", session: session(localDraft) }}
        reviewFilter="local"
        onReviewFilterChange={() => undefined}
        {...callbacks}
      />,
    );
    const withProposals = render("local");
    expect(taggedBlock(withProposals, 'data-local-candidate-kind="wall"', "data-local-candidate-kind"))
      .toBe(taggedBlock(withoutProposals, 'data-local-candidate-kind="wall"', "data-local-candidate-kind"));
    for (const privateId of ["wall-1", "wall-2", "opening-local", "proposal-door", "proposal-wall-review"]) {
      expect(render()).not.toContain(privateId);
    }
  });
});
