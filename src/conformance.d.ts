import type { SiteAgentManifest } from "./site-agent.js";
import type { SiteAgentCoverageEvidence } from "./coverage.js";

export interface ConformanceProof {
  id: string;
  profile: string;
  status: "passed" | "failed";
  durationMs: number;
  failureCode: string;
}

export declare function runSiteAgentConformance(options: {
  manifest: SiteAgentManifest;
  createAgent(context: { permissions: "authorized" | "denied" }): unknown | Promise<unknown>;
  cases: Record<string, unknown> & {
    coverage: { verify(input: { manifest: SiteAgentManifest }): SiteAgentCoverageEvidence | Promise<SiteAgentCoverageEvidence> };
  };
}): Promise<{
  valid: boolean;
  declaredComplete: boolean;
  executionVerified: boolean;
  fullyConformant: boolean;
  errors: string[];
  proofs: ConformanceProof[];
}>;
