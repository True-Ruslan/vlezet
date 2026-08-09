import { createStore, type StoreApi } from "zustand/vanilla";

export type StructuralSnappingSettingsState = Readonly<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}>;

export function createStructuralSnappingSettingsStore(): StoreApi<StructuralSnappingSettingsState> {
  return createStore<StructuralSnappingSettingsState>((set, get) => ({
    enabled: true,
    setEnabled: (enabled) => set({ enabled }),
    toggle: () => set({ enabled: !get().enabled }),
  }));
}

export const structuralSnappingSettingsStore = createStructuralSnappingSettingsStore();
