import type { HTMLAttributes, ReactNode } from "react";

export type UiCardVariant = "neutral" | "selectable" | "result" | "evidence";

export type UiCardProps = Readonly<Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  variant?: UiCardVariant;
  selected?: boolean;
  children: ReactNode;
}>;

export function UiCard({
  variant = "neutral",
  selected = false,
  children,
  className,
  ...attributes
}: UiCardProps) {
  const classes = [
    "ui-card",
    `ui-card-${variant}`,
    selected ? "is-selected" : null,
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      {...attributes}
      className={classes}
      data-variant={variant}
      data-selected={selected || undefined}
    >
      {children}
    </div>
  );
}
