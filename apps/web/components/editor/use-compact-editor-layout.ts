"use client";

import { useSyncExternalStore } from "react";

export const COMPACT_EDITOR_LAYOUT_QUERY = "(max-width: 1100px)";

function mediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(COMPACT_EDITOR_LAYOUT_QUERY);
}

function subscribe(onChange: () => void): () => void {
  const query = mediaQueryList();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return mediaQueryList()?.matches ?? false;
}

export function useCompactEditorLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
