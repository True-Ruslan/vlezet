import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type UiButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "icon";

export type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{
  variant?: UiButtonVariant;
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
}>;

export const UiButton = forwardRef<HTMLButtonElement, UiButtonProps>(function UiButton({
  variant = "secondary",
  busy = false,
  busyLabel = "Выполняется…",
  children,
  className,
  disabled,
  type = "button",
  ...props
}, ref) {
  const classes = ["ui-button", `ui-button-${variant}`, className].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-variant={variant}
    >
      <span className="ui-button-content">{busy ? busyLabel : children}</span>
    </button>
  );
});
