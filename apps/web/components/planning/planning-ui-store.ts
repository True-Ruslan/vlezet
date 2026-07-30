import type { PlanningCandidate } from "@vlezet/planning";
import { createStore } from "zustand/vanilla";
import { planningPairKey } from "./planning-pair-key";

function firstExactPairKey(candidate: PlanningCandidate | null): string | null {
  return (candidate?.constraints ?? [])
    .filter((constraint) => constraint.kind === "pair-min-gap")
    .map((constraint) => planningPairKey(constraint.objectIds[0], constraint.objectIds[1]))
    .sort((first, second) => first.localeCompare(second))[0] ?? null;
}

export type PlanningUiState = Readonly<{
  roomId: string | null;
  previewCandidate: PlanningCandidate | null;
  activeExactPairKey: string | null;
  openForRoom: (roomId: string) => void;
  setPreviewCandidate: (candidate: PlanningCandidate | null) => void;
  setActiveExactPairKey: (pairKey: string | null) => void;
  close: () => void;
}>;

export function createPlanningUiStore() {
  return createStore<PlanningUiState>()((set) => ({
    roomId: null,
    previewCandidate: null,
    activeExactPairKey: null,
    openForRoom: (roomId) => set({ roomId, previewCandidate: null, activeExactPairKey: null }),
    setPreviewCandidate: (previewCandidate) => set({
      previewCandidate,
      activeExactPairKey: firstExactPairKey(previewCandidate),
    }),
    setActiveExactPairKey: (activeExactPairKey) => set({ activeExactPairKey }),
    close: () => set({ roomId: null, previewCandidate: null, activeExactPairKey: null }),
  }));
}

export const planningUiStore = createPlanningUiStore();
