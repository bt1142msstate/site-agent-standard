import type { SiteAgentManifest } from "./site-agent.js";

export declare const REQUIRED_ACCESSIBILITY_RULES: readonly string[];
export declare function validateSiteOperabilityEvidence(
  manifest: SiteAgentManifest,
  evidence: Record<string, unknown>,
): {
  valid: boolean;
  readiness: "ready" | "not-ready";
  operabilityScore: number;
  dimensions: {
    navigation: { passed: number; total: number; score: number };
    query: { passed: number; total: number; score: number };
    accessibilityEvidence: { passed: number; applicable: number; testedRulePassRate: number; wcagConformanceClaim: "none" };
  };
  errors: readonly string[];
  warnings: readonly string[];
};
