import type { RealAnalogueDefinition } from "../../packages/recognition/benchmarks/real-analogues/source-definitions.mjs";

export type RealFixtureVerificationReport = Readonly<{
  fixtureCount: number;
  hashMismatches: string[];
  provenanceViolations: string[];
  privateDigestLeaks: string[];
  failureExpectationErrors: string[];
}>;

export function verifyRealFixtureDirectory(input: Readonly<{
  root: string;
  definitions?: readonly RealAnalogueDefinition[];
}>): Promise<RealFixtureVerificationReport>;
