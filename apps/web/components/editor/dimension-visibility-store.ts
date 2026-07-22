import { createStore } from "zustand/vanilla";

export type DimensionVisibilityState = {
  visible: boolean;
  toggle: () => void;
};

export function createDimensionVisibilityStore() {
  return createStore<DimensionVisibilityState>((set) => ({
    visible: true,
    toggle: () => set((state) => ({ visible: !state.visible })),
  }));
}

export const dimensionVisibilityStore = createDimensionVisibilityStore();
