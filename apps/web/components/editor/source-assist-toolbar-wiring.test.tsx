import { Children, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
  useStore: vi.fn((store: { getState: () => unknown }, selector: (state: never) => unknown) =>
    selector(store.getState() as never),
  ),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: hookMocks.useEffect,
    useState: hookMocks.useState,
  };
});

vi.mock("zustand", () => ({
  useStore: hookMocks.useStore,
}));

import {
  EditorToolbar,
  EditorToolBarView,
  type EditorToolBarViewProps,
} from "./editor-toolbar";
import { sourceAssistSettingsStore } from "./source-assist-settings-store";

const noop = () => {};

const connectedProps = {
  projectName: "Квартира",
  saveStatus: { kind: "idle" } as const,
  furnitureCatalogOpen: false,
  referencePanelOpen: false,
  recognitionPanelOpen: false,
  hasReferencePlan: true,
  onBack: noop,
  onRenameProject: noop,
  onToggleFurnitureCatalog: noop,
  onToggleReferencePanel: noop,
  onToggleRecognitionPanel: noop,
  onRetrySave: noop,
  onFit: noop,
  onExportJson: noop,
  onExportPng: noop,
  onExportPngWithReference: noop,
};

function toolBarElementFromConnectedToolbar(): ReactElement<EditorToolBarViewProps> {
  const tree = EditorToolbar(connectedProps) as ReactElement<{ children: ReactNode }>;
  const children = Children.toArray(tree.props.children);
  return children[1] as ReactElement<EditorToolBarViewProps>;
}

function sourceAssistCommandFromView(): ReactElement<{
  label: string;
  onClick: () => void;
}> {
  const tree = EditorToolBarView({
    tool: "wall",
    measurementActive: false,
    dimensionsVisible: true,
    viewMode: "2d",
    placementPresetId: null,
    furnitureCatalogOpen: false,
    referencePanelOpen: false,
    recognitionPanelOpen: false,
    hasReferencePlan: true,
    editingDisabled: false,
    onChooseTool: noop,
    onActivateMeasurement: noop,
    onToggleDimensions: noop,
    onToggleFurniture: noop,
    onToggleReference: noop,
    onToggleRecognition: noop,
    onChooseViewMode: noop,
  }) as ReactElement<{ children: ReactNode }>;

  const navChildren = Children.toArray(tree.props.children);
  const editingGroup = navChildren[0] as ReactElement<{ children: ReactNode }>;
  const commands = Children.toArray(editingGroup.props.children) as ReactElement<{
    label: string;
    onClick: () => void;
  }>[];
  const sourceAssist = commands.find((command) => command.props.label === "По подложке");
  expect(sourceAssist).toBeDefined();
  return sourceAssist as ReactElement<{ label: string; onClick: () => void }>;
}

describe("M8.4 connected source assist toolbar wiring", () => {
  beforeEach(() => {
    sourceAssistSettingsStore.getState().setEnabled(false);
    hookMocks.useStore.mockClear();
    hookMocks.useEffect.mockClear();
  });

  it("reads the runtime store and wires the connected toggle back to that store", () => {
    const toolbar = toolBarElementFromConnectedToolbar();
    expect(toolbar.props.sourceAssistEnabled).toBe(false);

    toolbar.props.onToggleSourceAssist?.();
    expect(sourceAssistSettingsStore.getState().enabled).toBe(true);

    const rerendered = toolBarElementFromConnectedToolbar();
    expect(rerendered.props.sourceAssistEnabled).toBe(true);
  });

  it("keeps the optional view-level toggle fallback safe for legacy/direct renderers", () => {
    const sourceAssist = sourceAssistCommandFromView();
    expect(() => sourceAssist.props.onClick()).not.toThrow();
  });
});
