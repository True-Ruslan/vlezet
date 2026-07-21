"use client";

import { useEffect, useState } from "react";

export type ReferenceImageState = Readonly<{
  image: HTMLImageElement | null;
  error: string | null;
}>;

export function useReferenceImage(blob: Blob | null): ReferenceImageState {
  const [state, setState] = useState<ReferenceImageState>({ image: null, error: null });

  useEffect(() => {
    if (!blob) {
      setState({ image: null, error: null });
      return;
    }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let active = true;
    image.onload = () => { if (active) setState({ image, error: null }); };
    image.onerror = () => { if (active) setState({ image: null, error: "Не удалось показать сохранённую подложку." }); };
    image.src = url;
    return () => {
      active = false;
      image.src = "";
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  return state;
}
