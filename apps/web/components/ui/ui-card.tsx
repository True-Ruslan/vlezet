import type { ReactNode } from "react";

export type UiCardVariant = "neutral" | "selectable" | "result" | "evidence";

export type UiCardProps = Readonly<{
  variant?: UiCardVariant;
  selected?: boolean;
  children: ReactNode;
  className?: string;
}>;

export function UiCard({ variant = "neutral", selected = false, children, className }: UiCardProps) {
  const classes = [
    "ui-card",
    `ui-card-${variant}`,
    selected ? "is-selected" : null,
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} data-variant={variant} data-selected={selected || undefined}>
      {children}
    </div>
  );
}
