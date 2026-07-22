export type TapePointerGateInput = Readonly<{
  commit: boolean;
  button: number;
  buttons: number;
  spacePressed: boolean;
  hasMeasurement: boolean;
  measurementComplete: boolean;
}>;

export function shouldHandleTapePointer(input: TapePointerGateInput): boolean {
  if (input.commit) {
    return input.button === 0 && !input.spacePressed;
  }
  return input.hasMeasurement && !input.measurementComplete && input.buttons === 0 && !input.spacePressed;
}
