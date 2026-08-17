import { fitCalibrationViewport } from "./calibration-viewport";
import type {
  CalibrationStageHandlers,
  CalibrationStageSnapshot,
} from "./calibration-stage-controller";

const FIT_PADDING_PX = 16;

type CalibrationImageSize = Readonly<{
  naturalWidth: number;
  naturalHeight: number;
}>;

type CalibrationStageStateSetter = (
  update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot),
) => void;

export function bindCalibrationStageElement(
  image: CalibrationImageSize | null,
  setElement: (element: HTMLDivElement | null) => void,
  setState: CalibrationStageStateSetter,
  element: HTMLDivElement | null,
) {
  setElement(element);
  if (!element || !image) return;

  setState((state) => {
    if (state.viewport !== null) return state;
    return {
      ...state,
      viewport: fitCalibrationViewport({
        naturalSize: { width: image.naturalWidth, height: image.naturalHeight },
        containerSize: { width: element.clientWidth, height: element.clientHeight },
        paddingPx: FIT_PADDING_PX,
      }),
    };
  });
}

export function installCalibrationStageWheelListener(
  element: HTMLDivElement | null,
  handlers: CalibrationStageHandlers | null,
) {
  if (!element || !handlers) return undefined;
  const listener = handlers.onWheel as (event: WheelEvent) => void;
  element.addEventListener("wheel", listener, { passive: false });
  return () => element.removeEventListener("wheel", listener);
}
