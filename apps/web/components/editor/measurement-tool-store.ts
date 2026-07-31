import { createStore } from "zustand/vanilla";

export type MeasurementPhase = "idle" | "measuring" | "complete";

type MeasurementToolState = {
  active: boolean;
  phase: MeasurementPhase;
  setActive: (active: boolean) => void;
  setPhase: (phase: MeasurementPhase) => void;
  resetMeasurement: () => void;
};

export const measurementToolStore = createStore<MeasurementToolState>((set, get) => ({
  active: false,
  phase: "idle",
  setActive: (active) => set({ active, ...(!active ? { phase: "idle" as const } : {}) }),
  setPhase: (phase) => {
    if (!get().active) return;
    set({ phase });
  },
  resetMeasurement: () => set({ phase: "idle" }),
}));