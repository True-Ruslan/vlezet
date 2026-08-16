import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferenceImportState } from "./reference-import-machine";
import type { NormalizedReferenceRaster } from "./raster-normalizer";

const harness = vi.hoisted(() => ({
  state: null as ReferenceImportState | null,
  calibrationError: null as string | null,
  stateIndex: 0,
  refIndex: 0,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  pdfRef: { current: null as { destroy: () => Promise<void> } | null },
  inspectImpl: null as null | ((file: File) => Promise<Readonly<{ type: "png" | "jpeg" | "pdf"; bytes: ArrayBuffer }>>),
  normalizeImpl: null as null | ((file: File) => Promise<NormalizedReferenceRaster>),
  parseImpl: null as null | ((value: string) => number),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState(initial: unknown) {
      const index = harness.stateIndex++;
      const value = index === 0
        ? harness.state
        : index === 1
          ? false
          : harness.calibrationError;
      const setter = vi.fn((update: unknown) => {
        const current = index === 0
          ? harness.state
          : index === 1
            ? false
            : harness.calibrationError;
        const next = typeof update === "function"
          ? (update as (current: unknown) => unknown)(current)
          : update;
        if (index === 0) harness.state = next as ReferenceImportState;
        if (index === 2) harness.calibrationError = next as string | null;
      });
      harness.setters[index] = setter;
      return [value ?? (typeof initial === "function" ? (initial as () => unknown)() : initial), setter];
    },
    useRef(initial: unknown) {
      const index = harness.refIndex++;
      return index === 0 ? { current: initial } : harness.pdfRef;
    },
    useEffect() {},
  };
});

vi.mock("./reference-file", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reference-file")>();
  return {
    ...actual,
    inspectReferenceFile(file: File) {
      if (!harness.inspectImpl) throw new Error("inspectReferenceFile test implementation is missing");
      return harness.inspectImpl(file);
    },
  };
});

vi.mock("./raster-normalizer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./raster-normalizer")>();
  return {
    ...actual,
    normalizeImageFile(file: File) {
      if (!harness.normalizeImpl) throw new Error("normalizeImageFile test implementation is missing");
      return harness.normalizeImpl(file);
    },
  };
});

vi.mock("./calibration-input", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./calibration-input")>();
  return {
    ...actual,
    parseCalibrationLength(value: string) {
      if (!harness.parseImpl) throw new Error("parseCalibrationLength test implementation is missing");
      return harness.parseImpl(value);
    },
  };
});

import { CalibrationStage, ReferencePanel } from "./reference-panel";

const raster: NormalizedReferenceRaster = {
  blob: new Blob(["reference"], { type: "image/png" }),
  mimeType: "image/png",
  widthPx: 800,
  heightPx: 200,
};

function calibratingState(
  overrides: Partial<Extract<ReferenceImportState, { kind: "calibrating" }>> = {},
): Extract<ReferenceImportState, { kind: "calibrating" }> {
  return {
    kind: "calibrating",
    fileName: "plan.png",
    raster,
    source: "png",
    draft: {
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "3200",
      alignment: "horizontal",
    },
    ...overrides,
  };
}

function collectElements(node: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(collectElements);
  if (!isValidElement(node)) return [];
  const props = node.props as Readonly<{ children?: unknown }>;
  return [node, ...collectElements(props.children)];
}

function textContent(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (!isValidElement(node)) return "";
  return textContent((node.props as Readonly<{ children?: unknown }>).children);
}

function renderPanel(
  state: ReferenceImportState,
  options: Readonly<{
    calibrationError?: string | null;
    onInstall?: (draft: Parameters<Parameters<typeof ReferencePanel>[0]["onInstall"]>[0]) => Promise<void>;
  }> = {},
) {
  harness.state = state;
  harness.calibrationError = options.calibrationError ?? null;
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.setters.length = 0;
  const onInstall = vi.fn(options.onInstall ?? (async () => {}));
  const tree = ReferencePanel({
    referencePlan: null,
    assetBlob: null,
    missingAsset: false,
    navigation: { label: "Назад", onActivate: vi.fn() },
    onInstall,
    onUpdate: vi.fn(),
    onRemove: vi.fn(async () => {}),
    onStartTracing: vi.fn(),
    onFitReference: vi.fn(),
  });
  return { elements: collectElements(tree), onInstall };
}

function findButton(elements: readonly ReactElement[], label: string): ReactElement {
  const button = elements.find((element) => element.type === "button" && textContent(element) === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

beforeEach(() => {
  harness.state = null;
  harness.calibrationError = null;
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.setters.length = 0;
  harness.pdfRef.current = null;
  harness.inspectImpl = async () => ({ type: "png", bytes: new ArrayBuffer(8) });
  harness.normalizeImpl = async () => raster;
  harness.parseImpl = () => 3200;
});

describe("ReferencePanel calibration handlers", () => {
  it("clears an old calibration error when a new image import begins", async () => {
    const { elements } = renderPanel({ kind: "idle" }, { calibrationError: "Старая ошибка" });
    const fileInput = elements.find((element) => element.type === "input" && element.props["aria-label"] === "Загрузить план квартиры");
    expect(fileInput).toBeDefined();

    const event = {
      target: { files: [{ name: "fresh.png" }] },
      currentTarget: { value: "chosen" },
    };
    (fileInput!.props.onChange as (event: typeof event) => void)(event);

    await vi.waitFor(() => expect(harness.state?.kind).toBe("calibrating"));
    expect(event.currentTarget.value).toBe("");
    expect(harness.setters[2]).toHaveBeenCalledWith(null);
  });

  it("executes calibration field handlers and clears stale inline validation", () => {
    const { elements } = renderPanel(calibratingState(), { calibrationError: "Исправьте калибровку" });
    const stage = elements.find((element) => element.type === CalibrationStage);
    const lengthInput = elements.find((element) => element.type === "input" && element.props.placeholder === "Например, 3200 или 3,2 м");
    const alignment = elements.find((element) => element.type === "select");

    expect(stage).toBeDefined();
    expect(lengthInput).toBeDefined();
    expect(alignment).toBeDefined();

    (stage!.props.onChange as (patch: { pointA: { x: number; y: number } }) => void)({ pointA: { x: 120, y: 60 } });
    (lengthInput!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "3300" } });
    (alignment!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "vertical" } });

    expect(harness.setters[2]).toHaveBeenCalledTimes(3);
    expect(harness.calibrationError).toBeNull();
  });

  it("keeps the workflow open and exposes inline validation when save is incomplete", () => {
    const { elements, onInstall } = renderPanel(calibratingState({
      draft: {
        pointA: { x: 100, y: 50 },
        pointB: { x: 700, y: 50 },
        lengthInput: "",
        alignment: "horizontal",
      },
    }));
    const save = findButton(elements, "Сохранить и открыть план");

    (save.props.onClick as () => void)();

    expect(onInstall).not.toHaveBeenCalled();
    expect(harness.calibrationError).toBe("Укажите реальную длину между точками A и B.");
    expect(harness.state?.kind).toBe("calibrating");
  });

  it.each([
    ["png", undefined, undefined, { kind: "image", originalMimeType: "image/png" }],
    ["jpeg", undefined, undefined, { kind: "image", originalMimeType: "image/jpeg" }],
    ["pdf", undefined, undefined, { kind: "pdf", pageNumber: 1, pageCount: 1 }],
    ["pdf", 2, 5, { kind: "pdf", pageNumber: 2, pageCount: 5 }],
  ] as const)("saves a valid %s calibration through the existing persistence boundary", async (source, pageNumber, pageCount, expectedSource) => {
    const pdfDestroy = vi.fn(async () => {});
    harness.pdfRef.current = { destroy: pdfDestroy };
    const state = calibratingState({ source, ...(pageNumber === undefined ? {} : { pageNumber }), ...(pageCount === undefined ? {} : { pageCount }) });
    const { elements, onInstall } = renderPanel(state);
    const save = findButton(elements, "Сохранить и открыть план");

    (save.props.onClick as () => void)();

    await vi.waitFor(() => expect(onInstall).toHaveBeenCalledTimes(1));
    expect(onInstall).toHaveBeenCalledWith(expect.objectContaining({
      source: expectedSource,
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      knownLengthMm: 3200,
      alignment: "horizontal",
    }));
    await vi.waitFor(() => expect(harness.state?.kind).toBe("ready"));
    expect(pdfDestroy).toHaveBeenCalledTimes(1);
    expect(harness.pdfRef.current).toBeNull();
  });

  it("fails closed when calibration parsing throws an unexpected error", async () => {
    harness.parseImpl = () => { throw new Error("unexpected parser failure"); };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { elements, onInstall } = renderPanel(calibratingState());
    const save = findButton(elements, "Сохранить и открыть план");

    (save.props.onClick as () => void)();

    await vi.waitFor(() => expect(harness.state?.kind).toBe("failed"));
    expect(onInstall).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("translates install failure to the existing failed workflow state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { elements } = renderPanel(calibratingState(), {
      onInstall: async () => { throw new Error("storage unavailable"); },
    });
    const save = findButton(elements, "Сохранить и открыть план");

    (save.props.onClick as () => void)();

    await vi.waitFor(() => expect(harness.state?.kind).toBe("failed"));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("cancels calibration, clears its error and destroys a loaded PDF handle", async () => {
    const destroy = vi.fn(async () => {});
    harness.pdfRef.current = { destroy };
    const { elements } = renderPanel(calibratingState(), { calibrationError: "Ошибка" });
    const cancel = findButton(elements, "Отмена");

    (cancel.props.onClick as () => void)();

    expect(harness.calibrationError).toBeNull();
    expect(harness.state?.kind).toBe("idle");
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    expect(harness.pdfRef.current).toBeNull();
  });

  it("renders incomplete endpoint values without inventing missing markers", () => {
    const { elements } = renderPanel(calibratingState({
      draft: { pointA: null, pointB: null, lengthInput: "", alignment: "horizontal" },
    }));
    expect(elements.some((element) => textContent(element).includes("A: не выбрана"))).toBe(true);
    expect(elements.some((element) => textContent(element).includes("B: не выбрана"))).toBe(true);
  });
});
