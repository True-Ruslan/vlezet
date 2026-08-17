import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactHarness = vi.hoisted(() => ({
  stateCall: 0,
  refCall: 0,
  memoCall: 0,
  stateOverrides: new Map<number, unknown>(),
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  refs: [] as Array<{ current: unknown }>,
  memos: [] as Array<{ deps: readonly unknown[] | undefined; value: unknown }>,
  cleanups: [] as Array<(() => void) | undefined>,
}));

const controllerHarness = vi.hoisted(() => ({
  mode: "source" as "source" | "structural",
  resolve: vi.fn((input: {
    structuralSnap: { point: { x: number; y: number } };
    enabled: boolean;
  }) => {
    if (!input.enabled || controllerHarness.mode === "structural") {
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

function sameDeps(left: readonly unknown[] | undefined, right: readonly unknown[] | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => Object.is(value, right[index]));
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef<T>(initial: T) {
      const index = reactHarness.refCall++;
      const existing = reactHarness.refs[index] as { current: T } | undefined;
      if (existing) return existing;
      const ref = { current: initial };
      reactHarness.refs[index] = ref as { current: unknown };
      return ref;
    },
    useState<T>(initial: T | (() => T)) {
      const index = reactHarness.stateCall++;
      const setter = vi.fn();
      reactHarness.setters[index] = setter;
      const initialValue = typeof initial === "function" ? (initial as () => T)() : initial;
      return [reactHarness.stateOverrides.has(index) ? reactHarness.stateOverrides.get(index) : initialValue, setter];
    },
    useMemo<T>(factory: () => T, deps?: readonly unknown[]) {
      const index = reactHarness.memoCall++;
      const previous = reactHarness.memos[index] as { deps: readonly unknown[] | undefined; value: T } | undefined;
      if (previous && sameDeps(previous.deps, deps)) return previous.value;
      const value = factory();
      reactHarness.memos[index] = { deps: deps ? [...deps] : undefined, value };
      return value;
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
  reactHarness.refCall = 0;
  reactHarness.memoCall = 0;
  reactHarness.stateOverrides.clear();
  reactHarness.setters.length = 0;
  reactHarness.refs.length = 0;
  reactHarness.memos.length = 0;
}

function beginRender(): void {
  reactHarness.stateCall = 0;
  reactHarness.refCall = 0;
  reactHarness.memoCall = 0;
  reactHarness.setters.length = 0;
}

function renderCanvas(activeSourceAssistState?: unknown) {
  beginRender();
  if (activeSourceAssistState === undefined) reactHarness.stateOverrides.delete(9);
  else reactHarness.stateOverrides.set(9, activeSourceAssistState);

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
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(expect.objectContaining({
      contextToken: expect.any(Object),
      result: expect.objectContaining({ acquired: true }),
    }));

    const taggedEvidence = reactHarness.setters[9]!.mock.calls.at(-1)?.[0];
    const commitStage = stageFrom(renderCanvas(taggedEvidence));
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

  it("routes the first wall point through source authority when assist is enabled", () => {
    const tree = renderCanvas();
    const stage = stageFrom(tree);

    stage.props.onMouseDown(pointerEvent({ x: 240, y: 160 }));

    expect(controllerHarness.resolve).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      suppressed: false,
      activeCandidate: null,
      rawWorldPoint: { x: 240, y: 160 },
    }));
    expect(editorStore.getState().draftWall).toMatchObject({
      start: { x: 1000, y: 0 },
      end: { x: 1000, y: 0 },
      startTarget: null,
      endTarget: null,
    });
    expect(reactHarness.setters[9]).toHaveBeenCalledWith(expect.objectContaining({
      contextToken: expect.any(Object),
      result: expect.objectContaining({ acquired: true }),
    }));
  });

  it("keeps source assist out of non-wall placement interactions", () => {
    editorStore.setState({ tool: "select", placementPresetId: "runtime-placement" });
    const tree = renderCanvas();

    expect(tree.props.className).toContain("is-placing-object");
    stageFrom(tree).props.onMouseDown(pointerEvent({ x: 320, y: 180 }));

    expect(controllerHarness.resolve).not.toHaveBeenCalled();
  });

  it("keeps acquired evidence only inside the same runtime context and drops stale hysteresis on toggle change", () => {
    editorStore.getState().beginWall({ x: 0, y: 0 });
    const initialTree = renderCanvas();
    stageFrom(initialTree).props.onMouseMove(pointerEvent());

    const taggedEvidence = reactHarness.setters[9]!.mock.calls.at(-1)?.[0];
    expect(taggedEvidence).toEqual(expect.objectContaining({
      contextToken: expect.any(Object),
      result: expect.objectContaining({ acquired: true }),
    }));

    const acquiredTree = renderCanvas(taggedEvidence);
    expect(acquiredTree.props["data-source-assist"]).toBe("acquired");

    sourceAssistSettingsStore.setState({ enabled: false });
    const staleTree = renderCanvas(taggedEvidence);
    expect(staleTree.props["data-source-assist"]).toBe("idle");

    controllerHarness.resolve.mockClear();
    stageFrom(staleTree).props.onMouseMove(pointerEvent({ x: 120, y: 0 }));
    expect(controllerHarness.resolve).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      activeCandidate: null,
    }));
    expect(editorStore.getState().history.document).toEqual(editorStore.getInitialState().history.document);
  });
});
