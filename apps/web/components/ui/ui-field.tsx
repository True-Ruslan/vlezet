import { cloneElement, type ReactElement, type ReactNode } from "react";

export type UiFieldMessageTone = "helper" | "error" | "warning" | "success";

export type UiFieldMessageProps = Readonly<{
  tone?: UiFieldMessageTone;
  live?: boolean;
  children: ReactNode;
}>;

export function UiFieldMessage({ tone = "helper", live = false, children }: UiFieldMessageProps) {
  const role = tone === "error" ? "alert" : live ? "status" : undefined;
  return (
    <span
      className="ui-field-message"
      data-tone={tone}
      role={role}
      aria-live={live && tone !== "error" ? "polite" : undefined}
    >
      {children}
    </span>
  );
}

type FieldControlProps = Readonly<{
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>;

export type UiFieldProps = Readonly<{
  id: string;
  label: ReactNode;
  description?: ReactNode;
  unit?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  children: ReactElement;
}>;

export function UiField({
  id,
  label,
  description,
  unit,
  message,
  invalid = false,
  children,
}: UiFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const messageId = message ? `${id}-message` : undefined;
  const describedBy = [descriptionId, messageId].filter(Boolean).join(" ") || undefined;
  const control = children as ReactElement<FieldControlProps>;
  const controlClassName = ["ui-field-control", control.props.className].filter(Boolean).join(" ");
  const enhancedControl = cloneElement(control, {
    id,
    className: controlClassName,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
  });

  return (
    <div className="ui-field" data-invalid={invalid || undefined}>
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      {description ? <div className="ui-field-description" id={descriptionId}>{description}</div> : null}
      <div className="ui-field-control-row">
        {enhancedControl}
        {unit ? <span className="ui-field-unit" aria-hidden="true">{unit}</span> : null}
      </div>
      {message ? <div className="ui-field-message-slot" id={messageId}>{message}</div> : null}
    </div>
  );
}
