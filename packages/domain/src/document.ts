import type { Wall } from "./wall";

export type VlezetDocument = Readonly<{
  schemaVersion: 1;
  walls: readonly Wall[];
}>;

export function createEmptyDocument(): VlezetDocument {
  return {
    schemaVersion: 1,
    walls: [],
  };
}
