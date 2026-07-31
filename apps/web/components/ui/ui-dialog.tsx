"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

export type UiDialogProps = Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  closeOnEscape?: boolean;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}>;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function UiDialog({
  open,
  title,
  description,
  onClose,
  closeOnEscape = true,
  busy = false,
  initialFocusRef,
  children,
  footer,
  closeLabel = "Закрыть",
  className,
}: UiDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocusRef?.current ?? closeRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!closeOnEscape || busy) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [busy, closeOnEscape, initialFocusRef, onClose, open]);

  if (!open) return null;
  const classes = ["ui-dialog", className].filter(Boolean).join(" ");

  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={classes}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
      >
        <header className="ui-dialog-header">
          <div className="ui-dialog-heading">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            className="ui-dialog-close"
            type="button"
            aria-label={closeLabel}
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children ? <div className="ui-dialog-body">{children}</div> : null}
        {footer ? <footer className="ui-dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
