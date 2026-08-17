import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactHarness = vi.hoisted(() => ({
  stateCall: 0,
  stateOverrides: new Map<number, unknown>(),
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  cleanups: [] as Array<(() => void) | undefined>,
}));

const controllerHarness = vi.hoisted(() => ({
  mode: "source" as "source" | "structural",
  resolve: vi.fn((input: { structuralSnap: { point: { x: number; y: number } } }) => {
    if (controllerHarness.mode === "structural") {
      return {
        decision: {
          authority: "structural" as const,
          point: input.structuralSnap.point,
          structuralSnap: input.structuralSnap,
          sourceAssist: null,
        },
        sourceAssist: null,
        activeCandidate: null,
      };
    }
    const sourceAssist = {
      acquired: true,
      candidateId: "source-edge-1",
      worldPoint: { x: 1000, y: 0 },
    };
    return {
      decision: {
        authority: "source" as const,
        point: sourceAssist.worldPoint,
        structuralSnap: input.structuralSnap,
        sourceAssist,
      },
      sourceAssist,
      activeCandidate: { id: sourceAssist.candidateId, referenceRevision: "reference-1" },
    };
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef<T>(initial: T) {
      return { current: initial };
    },
    useState<T>(initial: T | (() => T)) {
      const index = reactHarness.stateCall++;
      const setter = vi.fn();
      reactHarness.setters[index] = setter;
      const initialValue = typeof initial === "function" ? (initial as () => T)() : initial;
      return [reactHarness.stateOverrides.has(index) ? reactHarness.stateOverrides.get(index) : initialValue, setter];
    },
    useMemo<T>(factory: () => T) {
      return factory();
    },
    useCallback<T>(callback: T) {
      return callback;
    },
    useEffect(effect: () => void | (() => void)) {
      reactHarness.cleanups.push(effect() ?? undefined);
    },
  };
});

vi.mock("zustand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zustand")>();
  return {
    ...actual,
    useStore<TState, TSlice>(
      store: { getState: () => TState },
      selector: (state: TState) => TSlice,
    ) {
      return selector(store.getState());
    },
  };
});

vi.mock("./wall-source-assist-controller", () => ({
  resolveWallSourceAssistController: controllerHarness.resolve,
}));

vi.mock("../reference/use-reference-image", () => ({
  useReferenceImage: () => ({ image: null }),
}));

import { EditorCanvas } from "./editor-canvas";
import { sourceAssistSettingsStore } from "./source-assist-settings-store";
import { editorStore } from "./use-editor-store";

const INITIAL_VIEWPORT = {
  offsetX: 0,
  offsetY: 0,
  pixelsPerMillimeter: 1,
} as const;

function resetHarness(): void {
  for (const cleanup of reactHarness.cleanups.splice(0)) cleanup?.();
  reactHarness.stateCall = 0;
  reactHarness.stateOverrides.clear();
  reactHarness.setters.length = 0;
}

function renderCanvas(activeSourceAssist?: unknown) {
  reactHarness.stateCall = 0;
  reactHarness.setters.length = 0;
  if (activeSourceAssist === undefined) reactHarness.stateOverrides.delete(9);
  else reactHarness.stateOverrides.set(9, activeSourceAssist);

  return EditorCanvas({
    initialViewport: INITIAL_VIEWPORT,
    onViewportChange: vi.fn(),
    onPointerWorldChange: vi.fn(),
    viewCommandRequest: null,
    fitReferenceRequest: 0,
    referencePlan: null,
    referenceAssetBlob: null,
    tracingMode: false,
    recognitionDraft: null,
    selectedRecognitionCandidateId: null,
    recognitionReviewActive: false,
    onSelectRecognitionCandidate: vi.fn(),
    onEditRecognitionWall: vi.fn(),
    onReferenceMoveEnd: vi.fn(),
    onContextMenuRequest: vi.fn(),
  }) as unknown as { props: Record<string, unknown> };
}

function stageFrom(tree: { props: Record<string, unknown> }) {
  const children = tree.props.children;
  const values = Array.isArray(children) ? children : [children];
  const stage = values.find((child) =>
    child && typeof child === "object" && "props" in child &&
    typeof (child as { props?: { onMouseMove?: unknown } }).props?.onMouseMove === "function");
  if (!stage) throw new Error("EditorCanvas Stage was not found");
  return stage as {
    props: {
      onMouseMove: (event: unknown) => void;
      onMouseDown: (event: unknown) => void;
      onMouseLeave: () => void;
    };
  };
}

function pointerEvent(point = { x: 100, y: 0 }) {
  const target = {
    getStage: () => ({
      getPointerPosition: () => point,
      getIntersection: () => null,
    }),
    name: () => "",
    getParent: () => null,
  };
  return {
    target,
    cancelBubble: false,
    evt: {
      button: 0,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      clientX: point.x,
      clientY: point.y,
      preventDefault: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  resetHarness();
  editorStore.setState(editorStore.getInitialState(), true);
  editorStore.getState().setTool("wall");
  sourceAssistSettingsStore.setState({ enabled: true });
  controllerHarness.mode = "source";
  controllerHarness.resolve.mockClear();
});

afterEach(() => {
  resetHarness();
  editorStore.setState(editorStore.getInitialState(), true);
  sourceAssistSettingsStore.setState({ enabled: false });
  vi.unstubAllGlobals();
});

describe("EditorCanvas source-assist runtime wiring", () => {
  it("routes a live wall draft through source authority and commits the ordinary wall", () => {
    editorStore.getState().beginWall({ x: 0, y: 0 });
    const tree = renderCanvas();
    const stage = stageFrom(tree);

    stage.props.onMouseMove(pointerEvent());

    expect(controllerHarness.resolve).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      suppressed: false,
      activeCandidate: null,
      rawWorldPoint: { x: 100, y: 0 },
    }));
    expect(editorStore.getState().draftWall?.end).toEqual({ x: 1000, y: 0 });
    expect(editorStore.getState().draftWall?.endTarget).toBeNull();
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(expect.objectContaining({ acquired: true }));

    const commitStage = stageFrom(renderCanvas());
    commitStage.props.onMouseDown(pointerEvent());

    expect(editorStore.getState().history.document.walls).toHaveLength(1);
    expect(editorStore.getState().draftWall).toMatchObject({
      start: { x: 1000, y: 0 },
      end: { x: 1000, y: 0 },
      startTarget: {
        kind: "vertex",
        point: { x: 1000, y: 0 },
      },
      endTarget: null,
    });
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(null);
  });

  it("keeps structural authority, applies exact wall input, and clears runtime evidence", () => {
    controllerHarness.mode = "structural";
    editorStore.getState().beginWall({ x: 0, y: 0 });
    reactHarness.stateOverrides.set(10, {
      lengthValue: "500",
      angleValue: "0",
      lengthEdited: true,
      angleEdited: true,
    });
    const tree = renderCanvas();
    const stage = stageFrom(tree);

    stage.props.onMouseMove(pointerEvent({ x: 420, y: 70 }));

    expect(editorStore.getState().draftWall?.end.x).toBeCloseTo(500, 6);
    expect(editorStore.getState().draftWall?.end.y).toBeCloseTo(0, 6);
    expect(editorStore.getState().draftWall?.endTarget).toBeNull();

    stage.props.onMouseLeave();
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(null);
  });

  it("starts a new ordinary wall without consulting source assist", () => {
    const tree = renderCanvas();
    const stage = stageFrom(tree);

    stage.props.onMouseDown(pointerEvent({ x: 240, y: 160 }));

    expect(editorStore.getState().draftWall).not.toBeNull();
    expect(controllerHarness.resolve).not.toHaveBeenCalled();
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(null);
  });

  it("exposes acquired and idle source evidence without persisting it", () => {
    const acquired = { acquired: true, candidateId: "source-edge-1", worldPoint: { x: 1000, y: 0 } };
    const acquiredTree = renderCanvas(acquired);
    expect(acquiredTree.props["data-source-assist"]).toBe("acquired");

    const idleTree = renderCanvas(null);
    expect(idleTree.props["data-source-assist"]).toBe("idle");
    expect(editorStore.getState().history.document).toEqual(editorStore.getInitialState().history.document);
  });
});
