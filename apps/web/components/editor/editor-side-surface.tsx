import type { ReactNode } from "react";

export type EditorSideSurfaceProps = Readonly<{
  id: string;
  side: "left" | "right";
  label: string;
  compact: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}>;

export function EditorSideSurface({
  id,
  side,
  label,
  compact,
  open,
  onClose,
  children,
}: EditorSideSurfaceProps) {
  const hidden = compact && !open;
  const classes = [
    "editor-side-surface",
    compact ? "is-compact" : "is-docked",
    compact && open ? "is-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <aside
      id={id}
      className={classes}
      data-side={side}
      data-modal="false"
      aria-label={label}
      aria-hidden={hidden || undefined}
      hidden={hidden}
      inert={hidden ? true : undefined}
    >
      {compact ? (
        <div className="editor-side-surface-header">
          <strong>{label}</strong>
          <button type="button" onClick={onClose} aria-label="Закрыть панель">×</button>
        </div>
      ) : null}
      <div className="editor-side-surface-content">{children}</div>
    </aside>
  );
}
