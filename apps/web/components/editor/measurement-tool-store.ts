import { createStore } from "zustand/vanilla";

type MeasurementToolState = {
  active: boolean;
  setActive: (active: boolean) => void;
};

export const measurementToolStore = createStore<MeasurementToolState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
