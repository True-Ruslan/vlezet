"use client";

import { useEffect, useState } from "react";

export type ReferenceImageState = Readonly<{
  image: HTMLImageElement | null;
  error: string | null;
}>;

type LoadedReferenceImageState = ReferenceImageState & Readonly<{ blob: Blob }>;

export function useReferenceImage(blob: Blob | null): ReferenceImageState {
  const [loaded, setLoaded] = useState<LoadedReferenceImageState | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let active = true;
    image.onload = () => { if (active) setLoaded({ blob, image, error: null }); };
    image.onerror = () => { if (active) setLoaded({ blob, image: null, error: "Не удалось показать сохранённую подложку." }); };
    image.src = url;
    return () => {
      active = false;
      image.src = "";
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  if (!blob || loaded?.blob !== blob) return { image: null, error: null };
  return { image: loaded.image, error: loaded.error };
}
