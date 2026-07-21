"use client";

import { useEffect, useRef } from "react";

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
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const active = document.activeElement;
      if (event.shiftKey && active === cancelRef.current) {
        event.preventDefault();
        confirmRef.current?.focus();
      } else if (!event.shiftKey && active === confirmRef.current) {
        event.preventDefault();
        cancelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} className="secondary-action compact-action" type="button" onClick={onCancel}>Отмена</button>
          <button ref={confirmRef} className={danger ? "danger-action compact-action" : "primary-action compact-action"} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
