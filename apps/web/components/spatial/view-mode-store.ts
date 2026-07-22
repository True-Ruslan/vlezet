import { createStore } from "zustand/vanilla";

export type SpatialViewMode = "2d" | "3d";

export type SpatialViewModeState = Readonly<{
  mode: SpatialViewMode;
  setMode: (mode: SpatialViewMode) => void;
}>;

export function createSpatialViewModeStore(initialMode: SpatialViewMode = "2d") {
  return createStore<SpatialViewModeState>()((set) => ({
    mode: initialMode,
    setMode: (mode) => set({ mode }),
  }));
}

export const spatialViewModeStore = createSpatialViewModeStore();
