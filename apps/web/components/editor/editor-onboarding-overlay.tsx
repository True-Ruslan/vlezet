"use client";

import { deriveRooms } from "@vlezet/geometry";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { planningUiStore } from "../planning/planning-ui-store";
import { formatSquareMeters } from "../ui/presentation-format";
import { EditorOperationEvidenceNotice } from "./editor-operation-evidence";
import {
  editorOperationEvidenceStore,
  visibleEditorOperationEvidence,
  type EditorEvidenceAction,
} from "./editor-operation-evidence-store";
import { FirstProjectGuide } from "./first-project-guide";
import {
  readFirstProjectGuideDismissed,
  writeFirstProjectGuideDismissed,
} from "./first-project-guide-preference";
import { deriveFirstProjectProgress } from "./first-project-progress";
import {
  observeFirstRoomTransition,
  type FirstRoomObservation,
} from "./first-room-transition";
import { editorStore } from "./use-editor-store";

export type EditorOnboardingOverlayProps = Readonly<{
  projectId: string;
  viewMode: "2d" | "3d";
  recognitionPanelOpen: boolean;
  referencePanelOpen: boolean;
  tracingMode: boolean;
  planningOpen: boolean;
  onOpenRecognitionReview: () => void;
}>;

function runtimeEvidenceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function EditorOnboardingOverlay({
  projectId,
  viewMode,
  recognitionPanelOpen,
  referencePanelOpen,
  tracingMode,
  planningOpen,
  onOpenRecognitionReview,
}: EditorOnboardingOverlayProps) {
  const document = useStore(editorStore, (state) => state.history.document);
  const evidence = useStore(editorOperationEvidenceStore, (state) => state.evidence);
  const [guideDismissed, setGuideDismissed] = useState(true);
  const observationRef = useRef<FirstRoomObservation | null>(null);

  const rooms = useMemo(() => deriveRooms(document).rooms, [document]);
  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);
  const roomIdsKey = roomIds.join("\u0000");
  const validRoomIds = useMemo(() => new Set(roomIds), [roomIds]);
  const progress = useMemo(() => deriveFirstProjectProgress({
    wallCount: document.walls.length,
    roomCount: rooms.length,
  }), [document.walls.length, rooms.length]);
  const visibleEvidence = visibleEditorOperationEvidence(evidence, projectId, validRoomIds);

  useEffect(() => {
    editorOperationEvidenceStore.getState().clearForProjectSwitch();
    setGuideDismissed(readFirstProjectGuideDismissed(projectId));
    observationRef.current = { projectId, roomIds };
  }, [projectId]);

  useEffect(() => {
    const transition = observeFirstRoomTransition(observationRef.current, { projectId, roomIds });
    observationRef.current = transition.next;
    if (!transition.createdRoomId) return;

    const room = rooms.find((candidate) => candidate.id === transition.createdRoomId);
    if (!room) return;
    editorOperationEvidenceStore.getState().publish({
      id: runtimeEvidenceId(),
      projectId,
      kind: "first-room-created",
      tone: "success",
      title: "Первая комната создана",
      description: `${room.name || "Комната"}: ${formatSquareMeters(room.areaMm2 / 1_000_000)}. Площадь рассчитана по внутреннему контуру.`,
      sourceContext: "canvas",
      entityId: room.id,
      action: { kind: "select-room", roomId: room.id },
    });
  }, [projectId, roomIdsKey, rooms]);

  useEffect(() => {
    if (evidence && !visibleEvidence) editorOperationEvidenceStore.getState().dismiss();
  }, [evidence, visibleEvidence]);

  const dismissGuide = () => {
    setGuideDismissed(true);
    writeFirstProjectGuideDismissed(projectId);
  };

  const runGuideAction = () => {
    if (progress.primaryAction === "activate-wall-tool") {
      editorStore.getState().setTool("wall");
      return;
    }
    if (progress.primaryAction === "select-first-room") {
      const room = rooms[0];
      if (room) editorStore.getState().selectRoom(room.id);
    }
  };

  const runEvidenceAction = (action: EditorEvidenceAction) => {
    switch (action.kind) {
      case "select-room":
        if (validRoomIds.has(action.roomId)) editorStore.getState().selectRoom(action.roomId);
        break;
      case "open-recognition-review":
        if (!recognitionPanelOpen) onOpenRecognitionReview();
        break;
      case "undo":
        editorStore.getState().undo();
        break;
      case "dismiss":
        editorOperationEvidenceStore.getState().dismiss();
        break;
    }
  };

  const guideVisible = viewMode === "2d" &&
    !guideDismissed &&
    !recognitionPanelOpen &&
    !referencePanelOpen &&
    !planningOpen &&
    !tracingMode;

  return (
    <>
      {guideVisible ? (
        <FirstProjectGuide
          progress={progress}
          onPrimaryAction={runGuideAction}
          onDismiss={dismissGuide}
        />
      ) : null}
      {viewMode === "2d" && visibleEvidence ? (
        <EditorOperationEvidenceNotice
          evidence={visibleEvidence}
          onAction={runEvidenceAction}
          onDismiss={() => editorOperationEvidenceStore.getState().dismiss()}
        />
      ) : null}
    </>
  );
}
