import type {
  CompleteWallCenterlinesInput,
  WallCompletionDiagnosticCode,
} from "./wall-completion";
import type { LocalWallCenterline } from "./wall-topology";

export type RuntimeWallCompletionDiagnosticCode =
  | WallCompletionDiagnosticCode
  | "completion-disabled-product-neutral";

export interface RuntimeWallCompletionResult {
  readonly centerlines: readonly LocalWallCenterline[];
  readonly diagnostics: readonly {
    readonly code: RuntimeWallCompletionDiagnosticCode;
    readonly firstIndex: number | null;
    readonly secondIndex: number | null;
    readonly message: string;
  }[];
  readonly acceptedCompletionCount: number;
}

function copyCenterline(centerline: LocalWallCenterline): LocalWallCenterline {
  return {
    ...centerline,
    startPx: { ...centerline.startPx },
    endPx: { ...centerline.endPx },
    reasons: [...centerline.reasons],
  };
}

export function completeWallCenterlines(
  input: CompleteWallCenterlinesInput,
): RuntimeWallCompletionResult {
  return {
    centerlines: input.centerlines.map(copyCenterline),
    diagnostics: [{
      code: "completion-disabled-product-neutral",
      firstIndex: null,
      secondIndex: null,
      message: "Автоматическое восстановление стен отключено после нейтральной продуктовой проверки.",
    }],
    acceptedCompletionCount: 0,
  };
}
