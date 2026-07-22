import type { PlanningCandidate } from "@vlezet/planning";
import { createStore } from "zustand/vanilla";

export type PlanningUiState = Readonly<{
  roomId: string | null;
  previewCandidate: PlanningCandidate | null;
  openForRoom: (roomId: string) => void;
  setPreviewCandidate: (candidate: PlanningCandidate | null) => void;
  close: () => void;
}>;

export function createPlanningUiStore() {
  return createStore<PlanningUiState>()((set) => ({
    roomId: null,
    previewCandidate: null,
    openForRoom: (roomId) => set({ roomId, previewCandidate: null }),
    setPreviewCandidate: (previewCandidate) => set({ previewCandidate }),
    close: () => set({ roomId: null, previewCandidate: null }),
  }));
}

export const planningUiStore = createPlanningUiStore();
