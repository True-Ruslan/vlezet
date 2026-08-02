import type { CompleteWallCenterlinesInput } from "./wall-completion";
import type { LocalWallCenterline } from "./wall-topology";

function copyCenterline(centerline: LocalWallCenterline): LocalWallCenterline {
  return {
    ...centerline,
    startPx: { ...centerline.startPx },
    endPx: { ...centerline.endPx },
    reasons: [...centerline.reasons],
  };
}

export function completeWallCenterlines(input: CompleteWallCenterlinesInput) {
  return {
    centerlines: input.centerlines.map(copyCenterline),
    diagnostics: [{
      code: "completion-disabled-product-neutral" as const,
      firstIndex: null,
      secondIndex: null,
      message: "Автоматическое восстановление стен отключено после нейтральной продуктовой проверки.",
    }],
    acceptedCompletionCount: 0,
  } as const;
}
