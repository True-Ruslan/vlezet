import type { ReactNode } from "react";
import type { ContextDescriptor } from "./context-panel-contract";

export type ContextPanelNavigation = Readonly<{
  label: string;
  onActivate: () => void;
}>;

export function ContextPanelFrame({
  descriptor,
  navigation,
  children,
  className,
}: Readonly<{
  descriptor: ContextDescriptor;
  navigation?: ContextPanelNavigation;
  children: ReactNode;
  className?: string;
}>) {
  const label = `${descriptor.eyebrow}: ${descriptor.title}`;
  return (
    <aside
      className={["context-panel-frame", className].filter(Boolean).join(" ")}
      role="complementary"
      aria-label={label}
    >
      <header className="context-panel-header">
        {navigation ? (
          <button
            type="button"
            className="context-panel-navigation"
            aria-label={navigation.label}
            onClick={navigation.onActivate}
          >
            <span aria-hidden="true">←</span>
            <span>{navigation.label}</span>
          </button>
        ) : null}
        <div className="context-panel-identity">
          <span className="context-panel-eyebrow">{descriptor.eyebrow}</span>
          <h2 className="context-panel-title">{descriptor.title}</h2>
          {descriptor.subtitle ? <p className="context-panel-subtitle">{descriptor.subtitle}</p> : null}
          {descriptor.phase ? <p className="context-panel-phase">{descriptor.phase}</p> : null}
        </div>
      </header>
      <div className="context-panel-body">{children}</div>
    </aside>
  );
}

export function ContextSection({
  title,
  description,
  children,
  className,
}: Readonly<{
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={["context-panel-section", className].filter(Boolean).join(" ")}>
      {title || description ? (
        <div className="context-panel-section-heading">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      <div className="context-panel-section-content">{children}</div>
    </section>
  );
}

export function ContextActionArea({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="context-panel-action-area">{children}</div>;
}

export function ContextDangerZone({
  title = "Опасная зона",
  description,
  children,
}: Readonly<{
  title?: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="context-panel-danger-zone">
      <div className="context-panel-danger-heading">
        <h3>{title}</h3>
        <p className="context-panel-danger-description">{description}</p>
      </div>
      <div className="context-panel-danger-actions">{children}</div>
    </section>
  );
}
