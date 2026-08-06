import type { ReferencePlan } from "@vlezet/projects";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  peekAiLocalEvidenceForDraft,
  sanitizeAiProposalBatch,
} from "@vlezet/recognition";
import { OpenRouterDirectProvider } from "./openrouter-provider";
import { buildRecognitionAiProposalRequest } from "./recognition-ai-request";
import type { RecognitionController } from "./recognition-controller";

export type RecognitionAiProposalCredentials = Readonly<{
  apiKey: string;
  modelId: string;
}>;

export type RecognitionAiProposalSourceAsset = Readonly<{
  blob: Blob;
}>;

export type RunRecognitionAiProposalDiscoveryInput = Readonly<{
  controller: RecognitionController;
  credentials: RecognitionAiProposalCredentials;
  referencePlan: ReferencePlan;
  sourceAsset: RecognitionAiProposalSourceAsset;
  createSourceImage?: (blob: Blob) => Promise<ImageBitmap>;
  blobToDataUrl: (blob: Blob) => Promise<string>;
  now?: () => string;
}>;

export async function runRecognitionAiProposalDiscovery(
  input: RunRecognitionAiProposalDiscoveryInput,
): Promise<void> {
  const session = input.controller.state.session;
  if (!session) {
    throw new Error("Сначала выполните локальное распознавание.");
  }
  const initialEvidence = peekAiLocalEvidenceForDraft(session.draft);
  if (!initialEvidence) {
    throw new Error("Локальные проверочные данные устарели. Повторите локальное распознавание.");
  }

  const provider = new OpenRouterDirectProvider({
    apiKey: input.credentials.apiKey,
    modelId: input.credentials.modelId,
  });
  const createSourceImage = input.createSourceImage ?? createImageBitmap;
  const now = input.now ?? (() => new Date().toISOString());
  let completedRequestId: string | null = null;

  await input.controller.startAiProposalDiscovery(async ({
    session: currentSession,
    requestId,
    referenceRevision,
    localDraftFingerprint,
    signal,
  }) => {
    const currentEvidence = peekAiLocalEvidenceForDraft(currentSession.draft);
    if (
      !currentEvidence
      || currentEvidence.localDraftFingerprint !== localDraftFingerprint
      || input.referencePlan.referenceRevision !== referenceRevision
    ) {
      return null;
    }

    const sourceImage = await createSourceImage(input.sourceAsset.blob);
    try {
      const proposalRequest = buildRecognitionAiProposalRequest({
        requestId,
        sourceImageDataUrl: await input.blobToDataUrl(input.sourceAsset.blob),
        sourceImage,
        sourceWidthPx: input.referencePlan.widthPx,
        sourceHeightPx: input.referencePlan.heightPx,
        referenceRevision,
        localDraft: currentSession.draft,
        evidence: currentEvidence,
      });
      const providerResult = await provider.recognizeProposals(proposalRequest, signal);
      const sanitizedResult = sanitizeAiProposalBatch({
        batch: providerResult.batch,
        expectedIdentity: {
          requestId,
          referenceRevision,
          localDraftFingerprint,
        },
        provider: {
          providerId: providerResult.providerId,
          modelId: providerResult.modelId,
          requestId,
        },
        localDraft: currentSession.draft,
        localEvidence: currentEvidence,
      });
      if (sanitizedResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new Error("AI-пакет предложений не прошёл детерминированную проверку.");
      }
      completedRequestId = requestId;
      return {
        sanitized: sanitizedResult.sanitized,
        metadata: {
          schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
          requestId,
          referenceRevision,
          localDraftFingerprint,
          providerId: providerResult.providerId,
          modelId: providerResult.modelId,
          completedAt: now(),
        },
      };
    } finally {
      sourceImage.close();
    }
  });

  const appliedRequestId = input.controller.state.session?.draft.aiProposalMetadata?.requestId ?? null;
  if (completedRequestId === null || appliedRequestId !== completedRequestId) {
    throw new Error(
      "AI-поиск предложений не завершён. Локальный черновик и предыдущие валидные предложения сохранены.",
    );
  }
}
