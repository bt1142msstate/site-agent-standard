import type { SiteAgentManifest } from "./site-agent.js";

export type SiteAgentCoverageKind = "query" | "navigation" | "action";
export type SiteAgentCoverageDisposition = "queryable" | "navigable" | "executable" | "restricted" | "unresolved";

export interface SiteAgentCoverageDimension {
  kind: SiteAgentCoverageKind;
  discovered: number;
  covered: number;
  exempted: number;
  unresolved: number;
}

export interface SiteAgentCoverageRestriction {
  category: "legal" | "security" | "privacy" | "provider" | "human-judgment" | "physical-presence";
  reason: string;
  authority: string;
  reviewedByRole: string;
  reviewedAt: string;
}

export interface SiteAgentCoverageItem {
  kind: SiteAgentCoverageKind;
  identifierHash: string;
  actorClass: string;
  disposition: SiteAgentCoverageDisposition;
  capabilityId?: string;
  restriction?: SiteAgentCoverageRestriction;
}

export interface SiteAgentCoverageEvidence {
  source: "host-inventory";
  inventoryDigest: string;
  evidenceVersion?: 2;
  inventoryBasis?: "independent-user-surface";
  inventoryMethod?: "rendered-state-crawl" | "static-plus-runtime-sample" | "static-source";
  stateCoverage?: {
    discovered: number;
    exercised: number;
    viewports: Array<"desktop" | "mobile-touch" | string>;
  };
  dimensions: SiteAgentCoverageDimension[];
  items?: SiteAgentCoverageItem[];
  /** @deprecated Itemized restrictions replace aggregate exemptions in evidenceVersion 2. */
  exemptions?: Array<{ kind: SiteAgentCoverageKind; identifierHash: string; reason: string }>;
}

export declare function validateCoverageEvidence(
  manifest: SiteAgentManifest,
  evidence: SiteAgentCoverageEvidence,
): {
  valid: boolean;
  errors: readonly string[];
  dimensions: Readonly<Record<string, SiteAgentCoverageDimension | null>>;
  accountability: Readonly<{ itemized: boolean; complete: boolean }>;
};
