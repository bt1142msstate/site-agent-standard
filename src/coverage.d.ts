import type { SiteAgentManifest } from "./site-agent.js";

export interface SiteAgentCoverageDimension {
  kind: "query" | "navigation" | "action";
  discovered: number;
  covered: number;
  exempted: number;
  unresolved: number;
}

export interface SiteAgentCoverageEvidence {
  source: "host-inventory";
  inventoryDigest: string;
  dimensions: SiteAgentCoverageDimension[];
  exemptions?: Array<{
    kind: "query" | "navigation" | "action";
    identifierHash: string;
    reason: string;
  }>;
}

export declare function validateCoverageEvidence(
  manifest: SiteAgentManifest,
  evidence: SiteAgentCoverageEvidence,
): { valid: boolean; errors: readonly string[]; dimensions: Readonly<Record<string, SiteAgentCoverageDimension | null>> };
