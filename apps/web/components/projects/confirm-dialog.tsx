"use client";

import { useRef } from "react";
import { UiButton } from "../ui/ui-button";
import { UiDialog } from "../ui/ui-dialog";

export type ConfirmDialogProps = Readonly<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}>;

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <UiDialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      className="confirm-dialog"
      footer={
        <>
          <UiButton ref={cancelRef} variant="secondary" onClick={onCancel}>Отмена</UiButton>
          <UiButton variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</UiButton>
        </>
      }
    />
  );
}
