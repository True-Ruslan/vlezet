import type { ReactNode } from "react";

export type UiNoticeTone = "info" | "success" | "warning" | "error" | "local" | "limitation";
export type UiBadgeTone = "success" | "warning" | "danger" | "draft" | "preview" | "applied" | "mandatory" | "preference" | "confidence";

export type UiNoticeProps = Readonly<{
  tone: UiNoticeTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  live?: boolean;
  className?: string;
}>;

export function UiNotice({ tone, title, children, action, live = false, className }: UiNoticeProps) {
  const role = tone === "error" ? "alert" : live ? "status" : undefined;
  const classes = ["ui-notice", `ui-notice-${tone}`, className].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      data-tone={tone}
      role={role}
      aria-live={tone === "error" ? "assertive" : live ? "polite" : undefined}
    >
      <span className="ui-notice-marker" aria-hidden="true" />
      <div className="ui-notice-copy">
        <strong className="ui-notice-title">{title}</strong>
        {children ? <div className="ui-notice-body">{children}</div> : null}
      </div>
      {action ? <div className="ui-notice-action">{action}</div> : null}
    </div>
  );
}

export type UiBadgeProps = Readonly<{
  tone: UiBadgeTone;
  children: ReactNode;
  className?: string;
}>;

export function UiBadge({ tone, children, className }: UiBadgeProps) {
  const classes = ["ui-badge", `ui-badge-${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-tone={tone}>
      <span className="ui-badge-marker" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export type UiEmptyStateProps = Readonly<{
  title: ReactNode;
  children?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: ReactNode;
  className?: string;
}>;

export function UiEmptyState({ title, children, primaryAction, secondaryAction, icon, className }: UiEmptyStateProps) {
  const classes = ["ui-empty-state", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {icon ? <div className="ui-empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <strong className="ui-empty-state-title">{title}</strong>
      {children ? <div className="ui-empty-state-copy">{children}</div> : null}
      {primaryAction || secondaryAction ? (
        <div className="ui-empty-state-actions">
          {primaryAction ? <div className="ui-empty-state-primary">{primaryAction}</div> : null}
          {secondaryAction ? <div className="ui-empty-state-secondary">{secondaryAction}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
