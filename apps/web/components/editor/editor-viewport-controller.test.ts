import { screenToWorld, type ViewportTransform, type WorldBounds } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  actualSizeViewport,
  fitDocumentViewport,
  fitSelectionViewport,
  fitWorldBounds,
  panViewportBy,
  wheelGestureToViewportAction,
  zoomViewportByCommand,
} from "./editor-viewport-controller";

const limits = { min: 0.01, max: 2 } as const;

function viewport(): ViewportTransform {
  return { offsetX: 100, offsetY: 50, pixelsPerMillimeter: 0.1 };
}

describe("M8.1 pure viewport navigation controller", () => {
  it("pans in screen pixels without changing scale or mutating the source viewport", () => {
    const source = viewport();
    const snapshot = { ...source };

    const next = panViewportBy(source, { x: -24, y: 35 });

    expect(next).toEqual({ offsetX: 76, offsetY: 85, pixelsPerMillimeter: 0.1 });
    expect(source).toEqual(snapshot);
    expect(next).not.toBe(source);
  });

  it("zooms command-wise around the viewport centre and preserves that world anchor", () => {
    const source = viewport();
    const size = { width: 800, height: 600 };
    const centre = { x: size.width / 2, y: size.height / 2 };
    const worldBefore = screenToWorld(centre, source);

    const next = zoomViewportByCommand(source, size, 2, limits);

    expect(next.pixelsPerMillimeter).toBeCloseTo(0.2, 12);
    expect(screenToWorld(centre, next)).toEqual(worldBefore);
    expect(source).toEqual(viewport());
  });

  it("clamps command zoom to supplied limits without moving the viewport centre anchor", () => {
    const source = { offsetX: 10, offsetY: 20, pixelsPerMillimeter: 0.4 };
    const size = { width: 1000, height: 700 };
    const centre = { x: 500, y: 350 };
    const worldBefore = screenToWorld(centre, source);

    const next = zoomViewportByCommand(source, size, 10, { min: 0.05, max: 0.5 });

    expect(next.pixelsPerMillimeter).toBe(0.5);
    expect(screenToWorld(centre, next)).toEqual(worldBefore);
  });

  it("fits world bounds with padding, centring and caller-provided scale limits", () => {
    const bounds: WorldBounds = { minX: 0, minY: 0, maxX: 4000, maxY: 2000 };

    const fitted = fitWorldBounds(bounds, { width: 1000, height: 600 }, 100, limits);

    expect(fitted).toEqual({
      pixelsPerMillimeter: 0.2,
      offsetX: 100,
      offsetY: 100,
    });

    const clamped = fitWorldBounds(
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      { width: 1000, height: 1000 },
      0,
      { min: 0.05, max: 0.5 },
    );
    expect(clamped).toEqual({ pixelsPerMillimeter: 0.5, offsetX: 475, offsetY: 475 });
  });

  it("fits the union of document and visible reference bounds", () => {
    const documentBounds: WorldBounds = { minX: 0, minY: 0, maxX: 4000, maxY: 2000 };
    const referenceBounds: WorldBounds = { minX: -1000, minY: -500, maxX: 5000, maxY: 2500 };

    const fitted = fitDocumentViewport(
      documentBounds,
      referenceBounds,
      { width: 1200, height: 800 },
      100,
      limits,
    );

    expect(fitted?.pixelsPerMillimeter).toBeCloseTo(1 / 6, 12);
    expect(fitted?.offsetX).toBeCloseTo(1200 / 2 - 2000 / 6, 12);
    expect(fitted?.offsetY).toBeCloseTo(800 / 2 - 1000 / 6, 12);
  });

  it("fits the visible reference when the document is empty and fails closed when both bounds are absent", () => {
    const referenceBounds: WorldBounds = { minX: 1000, minY: 500, maxX: 5000, maxY: 2500 };

    const fitted = fitDocumentViewport(
      null,
      referenceBounds,
      { width: 1000, height: 600 },
      100,
      limits,
    );

    expect(fitted).toEqual(fitWorldBounds(referenceBounds, { width: 1000, height: 600 }, 100, limits));
    expect(fitDocumentViewport(null, null, { width: 1000, height: 600 }, 100, limits)).toBeNull();
  });

  it("fits semantic selection bounds and fails closed for empty selection", () => {
    expect(fitSelectionViewport(null, { width: 800, height: 600 }, 64, limits)).toBeNull();

    const fitted = fitSelectionViewport(
      { minX: 1000, minY: 500, maxX: 3000, maxY: 1500 },
      { width: 800, height: 600 },
      64,
      limits,
    );

    expect(fitted).not.toBeNull();
    expect(fitted?.pixelsPerMillimeter).toBeCloseTo(0.336, 12);
    expect(fitted?.offsetX).toBeCloseTo(-272, 12);
    expect(fitted?.offsetY).toBeCloseTo(-36, 12);
  });

  it("returns to the defined baseline scale around the viewport centre", () => {
    const source: ViewportTransform = { offsetX: -300, offsetY: 180, pixelsPerMillimeter: 0.4 };
    const size = { width: 1000, height: 700 };
    const centre = { x: size.width / 2, y: size.height / 2 };
    const worldBefore = screenToWorld(centre, source);

    const next = actualSizeViewport(source, size, 0.12, limits);

    expect(next.pixelsPerMillimeter).toBe(0.12);
    expect(screenToWorld(centre, next)).toEqual(worldBefore);
    expect(source).toEqual({ offsetX: -300, offsetY: 180, pixelsPerMillimeter: 0.4 });
  });

  it("classifies an ordinary wheel/trackpad stream as viewport pan with natural screen delta", () => {
    expect(wheelGestureToViewportAction({
      deltaX: 18,
      deltaY: -30,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })).toEqual({ kind: "pan", delta: { x: -18, y: 30 } });
  });

  it("maps Shift + vertical-only wheel to horizontal pan but preserves native two-axis trackpad deltas", () => {
    expect(wheelGestureToViewportAction({
      deltaX: 0,
      deltaY: 42,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    })).toEqual({ kind: "pan", delta: { x: -42, y: 0 } });

    expect(wheelGestureToViewportAction({
      deltaX: 12,
      deltaY: 42,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    })).toEqual({ kind: "pan", delta: { x: -12, y: -42 } });
  });

  it("classifies Ctrl/Cmd modified wheel or pinch as zoom and leaves the raw zoom delta intact", () => {
    expect(wheelGestureToViewportAction({
      deltaX: 0,
      deltaY: -120,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    })).toEqual({ kind: "zoom", deltaY: -120 });

    expect(wheelGestureToViewportAction({
      deltaX: 4,
      deltaY: 85,
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
    })).toEqual({ kind: "zoom", deltaY: 85 });
  });
});
