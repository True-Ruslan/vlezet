import { createStore, type StoreApi } from "zustand/vanilla";
import type { DoorSwingValue } from "./geometry-inspector-presentation";

export type RoomSpanPreview = Readonly<{
  roomId: string;
  axis: "horizontal" | "vertical";
}>;

export type DoorSwingPreview = Readonly<{
  openingId: string;
  value: DoorSwingValue;
}>;

export type GeometryInspectorPreviewState = {
  roomSpan: RoomSpanPreview | null;
  doorSwing: DoorSwingPreview | null;
  setRoomSpan: (preview: RoomSpanPreview | null) => void;
  setDoorSwing: (preview: DoorSwingPreview | null) => void;
  clearForSelection: (selection: Readonly<{
    roomId?: string | null;
    openingId?: string | null;
  }>) => void;
  reset: () => void;
};

const EMPTY_PREVIEW = {
  roomSpan: null,
  doorSwing: null,
} as const;

export function createGeometryInspectorPreviewStore(): StoreApi<GeometryInspectorPreviewState> {
  return createStore<GeometryInspectorPreviewState>((set, get) => ({
    ...EMPTY_PREVIEW,
    setRoomSpan: (roomSpan) => set({ roomSpan }),
    setDoorSwing: (doorSwing) => set({ doorSwing }),
    clearForSelection: ({ roomId = null, openingId = null }) => {
      const current = get();
      set({
        roomSpan: current.roomSpan?.roomId === roomId ? current.roomSpan : null,
        doorSwing: current.doorSwing?.openingId === openingId ? current.doorSwing : null,
      });
    },
    reset: () => set(EMPTY_PREVIEW),
  }));
}

export const geometryInspectorPreviewStore = createGeometryInspectorPreviewStore();
