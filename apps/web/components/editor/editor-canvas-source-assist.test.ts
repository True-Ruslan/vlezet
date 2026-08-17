import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.4 EditorCanvas wall source assist wiring", () => {
  it("subscribes to runtime-only source assistance and the wall controller", () => {
    expect(source).toContain('from "./source-assist-settings-store"');
    expect(source).toContain('from "./wall-source-assist-controller"');
    expect(source).toContain("const sourceAssistEnabled = useStore(sourceAssistSettingsStore");
    expect(source).toContain("const [activeSourceAssist, setActiveSourceAssist]");
    expect(source).toContain("const [activeSourceCandidate, setActiveSourceCandidate]");
  });

  it("resolves ordinary structural snapping first, then optional source assistance", () => {
    const start = source.indexOf("const updateWallDraftFromPointer");
    const end = source.indexOf("const updateOpeningPreview", start);
    const body = source.slice(start, end);

    expect(body).toContain("const resolved = resolveCanvasStructuralSnap(pointer, current.start, event)");
    expect(body).toContain("const rawWorldPoint = screenToWorld(pointer, viewport)");
    expect(body).toContain("resolveWallSourceAssistController({");
    expect(body).toContain("structuralSnap: resolved");
    expect(body).toContain("referencePlan");
    expect(body).toContain("referenceImage");
    expect(body).toContain("pixelsPerMillimeter: viewport.pixelsPerMillimeter");
    expect(body).toContain("enabled: sourceAssistEnabled");
    expect(body).toContain("suppressed: event.evt.altKey");
    expect(body).toContain("activeCandidate: activeSourceCandidate");
    expect(body).toContain("wallPointerWorldRef.current = assisted.decision.point");
    expect(body).toContain("let point = assisted.decision.point");
  });

  it("keeps source evidence ephemeral and topology targets structural-only", () => {
    const start = source.indexOf("const updateWallDraftFromPointer");
    const end = source.indexOf("const updateOpeningPreview", start);
    const body = source.slice(start, end);

    expect(body).toContain("setActiveSourceAssist(assisted.decision.sourceAssist)");
    expect(body).toContain("setActiveSourceCandidate(assisted.activeCandidate)");
    expect(body).toContain('assisted.decision.authority === "source"');
    expect(body).toContain('{ point, kind: "none", guides: [] }');
    expect(body).toContain("draftSnapFromStructural(resolved)");
    expect(body).toContain('assisted.decision.authority === "structural"');
    expect(body).toContain("targetForExactPoint(point, resolved)");
    expect(source).not.toContain("sourceAssist:");
    expect(source).not.toContain("sourceCandidate:");
  });

  it("clears acquired source identity when the wall/reference/toggle context changes", () => {
    expect(source).toContain("setActiveSourceAssist(null)");
    expect(source).toContain("setActiveSourceCandidate(null)");
    expect(source).toContain("referencePlan?.referenceRevision");
    expect(source).toContain("sourceAssistEnabled");
  });
});
