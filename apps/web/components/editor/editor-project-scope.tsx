"use client";

import { createContext, useContext, type ReactNode } from "react";

const EditorProjectIdContext = createContext<string | null>(null);

export function EditorProjectScope({ projectId, children }: Readonly<{ projectId: string; children: ReactNode }>) {
  return <EditorProjectIdContext.Provider value={projectId}>{children}</EditorProjectIdContext.Provider>;
}

export function useEditorProjectId(): string {
  const projectId = useContext(EditorProjectIdContext);
  if (!projectId) throw new Error("Editor project scope is missing.");
  return projectId;
}
