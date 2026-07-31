import type { FitStatus } from "@vlezet/geometry";
import { UiBadge, type UiBadgeTone } from "../ui/ui-feedback";

export type FitStatusPresentation = Readonly<{
  label: string;
  tone: UiBadgeTone;
}>;

const FIT_STATUS_PRESENTATION: Readonly<Record<FitStatus, FitStatusPresentation>> = {
  fits: { label: "Влезает", tone: "success" },
  tight: { label: "Влезает, но тесно", tone: "warning" },
  blocked: { label: "Не влезает", tone: "danger" },
};

export function fitStatusPresentation(status: FitStatus): FitStatusPresentation {
  return FIT_STATUS_PRESENTATION[status];
}

export function FitStatusBadge({ status }: Readonly<{ status: FitStatus }>) {
  const presentation = fitStatusPresentation(status);
  return <UiBadge tone={presentation.tone} className="fit-status-badge">{presentation.label}</UiBadge>;
}
