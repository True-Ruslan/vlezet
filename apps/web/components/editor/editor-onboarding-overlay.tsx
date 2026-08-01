"use client";

import { deriveRooms } from "@vlezet/geometry";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { subscribeProjectBackupExported } from "../projects/download-events";
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
import {
  observePlanningApplyTransition,
  type PlanningApplyObservation,
} from "./planning-apply-transition";
import {
  observeRecognitionApplyTransition,
  type RecognitionApplyObservation,
} from "./recognition-apply-transition";
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
  const history = useStore(editorStore, (state) => state.history);
  const document = history.document;
  const evidence = useStore(editorOperationEvidenceStore, (state) => state.evidence);
  const [guideDismissed, setGuideDismissed] = useState(true);
  const roomObservationRef = useRef<FirstRoomObservation | null>(null);
  const planningObservationRef = useRef<PlanningApplyObservation | null>(null);
  const recognitionObservationRef = useRef<RecognitionApplyObservation | null>(null);

  const rooms = useMemo(() => deriveRooms(document).rooms, [document]);
  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);
  const roomIdsKey = roomIds.join("\u0000");
  const validRoomIds = useMemo(() => new Set(roomIds), [roomIds]);
  const progress = useMemo(() => deriveFirstProjectProgress({
    wallCount: document.walls.length,
    roomCount: rooms.length,
  }), [document.walls.length, rooms.length]);
  const visibleEvidence = visibleEditorOperationEvidence(evidence, projectId, validRoomIds);
  const lastHistoryLabel = history.past[history.past.length - 1]?.forward.label ?? null;

  useEffect(() => {
    editorOperationEvidenceStore.getState().clearForProjectSwitch();
    setGuideDismissed(readFirstProjectGuideDismissed(projectId));
    roomObservationRef.current = { projectId, roomIds };
    planningObservationRef.current = {
      projectId,
      planningOpen,
      pastLength: history.past.length,
      lastLabel: lastHistoryLabel,
    };
    recognitionObservationRef.current = {
      projectId,
      pastLength: history.past.length,
      lastLabel: lastHistoryLabel,
    };
  }, [projectId]);

  useEffect(() => {
    const transition = observeFirstRoomTransition(roomObservationRef.current, { projectId, roomIds });
    roomObservationRef.current = transition.next;
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
    const current: PlanningApplyObservation = {
      projectId,
      planningOpen,
      pastLength: history.past.length,
      lastLabel: lastHistoryLabel,
    };
    const transition = observePlanningApplyTransition(planningObservationRef.current, current);
    planningObservationRef.current = transition.next;
    if (!transition.applied) return;

    editorOperationEvidenceStore.getState().publish({
      id: runtimeEvidenceId(),
      projectId,
      kind: "planning-applied",
      tone: "success",
      title: "Вариант расстановки применён",
      description: "Положение выбранной мебели обновлено. Изменение можно отменить одним действием.",
      sourceContext: "planning",
      action: { kind: "undo" },
    });
  }, [history.past.length, lastHistoryLabel, planningOpen, projectId]);

  useEffect(() => {
    const current: RecognitionApplyObservation = {
      projectId,
      pastLength: history.past.length,
      lastLabel: lastHistoryLabel,
    };
    const transition = observeRecognitionApplyTransition(recognitionObservationRef.current, current);
    recognitionObservationRef.current = transition.next;
    if (!transition.applied) return;

    editorOperationEvidenceStore.getState().publish({
      id: runtimeEvidenceId(),
      projectId,
      kind: "recognition-applied",
      tone: "success",
      title: "Распознавание применено",
      description: "Проверенные кандидаты добавлены как обычная редактируемая геометрия. Результат можно отменить одним действием.",
      sourceContext: "recognition",
      action: { kind: "undo" },
    });
  }, [history.past.length, lastHistoryLabel, projectId]);

  useEffect(() => subscribeProjectBackupExported((filename) => {
    editorOperationEvidenceStore.getState().publish({
      id: runtimeEvidenceId(),
      projectId,
      kind: "project-backup-exported",
      tone: "success",
      title: "Резервная копия сохранена",
      description: `Файл «${filename}» содержит редактируемый проект и подходит для последующего восстановления.`,
      sourceContext: "project",
      action: { kind: "dismiss" },
    });
  }), [projectId]);

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
