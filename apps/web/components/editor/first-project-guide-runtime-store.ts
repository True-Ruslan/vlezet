import { createStore } from "zustand/vanilla";
import {
  readFirstProjectGuideDismissed,
  writeFirstProjectGuideDismissed,
} from "./first-project-guide-preference";

export type FirstProjectGuideRuntimeAdapter = Readonly<{
  read: (projectId: string) => boolean;
  write: (projectId: string) => boolean;
}>;

export type FirstProjectGuideRuntimeState = Readonly<{
  projectId: string | null;
  dismissed: boolean;
  load: (projectId: string) => void;
  dismiss: (projectId: string) => void;
}>;

export function createFirstProjectGuideRuntimeStore(
  adapter: FirstProjectGuideRuntimeAdapter = {
    read: readFirstProjectGuideDismissed,
    write: writeFirstProjectGuideDismissed,
  },
) {
  return createStore<FirstProjectGuideRuntimeState>()((set, get) => ({
    projectId: null,
    dismissed: true,
    load: (projectId) => set({ projectId, dismissed: adapter.read(projectId) }),
    dismiss: (projectId) => {
      if (get().projectId !== projectId) return;
      adapter.write(projectId);
      set({ dismissed: true });
    },
  }));
}

export const firstProjectGuideRuntimeStore = createFirstProjectGuideRuntimeStore();
