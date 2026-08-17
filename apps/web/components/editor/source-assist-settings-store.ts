import { createStore, type StoreApi } from "zustand/vanilla";

export type SourceAssistSettingsState = Readonly<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}>;

export function createSourceAssistSettingsStore(): StoreApi<SourceAssistSettingsState> {
  return createStore<SourceAssistSettingsState>((set, get) => ({
    enabled: false,
    setEnabled: (enabled) => set({ enabled }),
    toggle: () => set({ enabled: !get().enabled }),
  }));
}

export const sourceAssistSettingsStore = createSourceAssistSettingsStore();
