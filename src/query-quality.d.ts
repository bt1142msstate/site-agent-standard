export interface QueryQualityCase {
  id: string;
  answerCorrect: boolean;
  expectedFacts: string[];
  supportedFacts: string[];
  requiredSources: string[];
  returnedSources: string[];
  completeness: "complete" | "partial" | "unknown";
  partialDisclosed?: boolean;
  resultIdentityVerified: boolean;
  resultDestinationExact: boolean;
  destinationStateVerified: boolean;
  destinationReady: boolean;
  toolCalls: number;
  transportCalls: number;
  internalRequests: number;
  deduplicatedRequests: number;
  durationMs: number;
}

export declare function evaluateQueryQuality(
  evidence: { cases: QueryQualityCase[] },
  budgets?: {
    maxToolCallsPerAnswer?: number;
    maxTransportCallsPerAnswer?: number;
    maxDurationMs?: number;
    minimumAccuracyPercent?: number;
    minimumEvidenceCoveragePercent?: number;
  },
): {
  valid: boolean;
  readiness: "ready" | "not-ready";
  cases: { passed: number; total: number; accuracyPercent: number };
  evidence: { supported: number; expected: number; coveragePercent: number };
  requests: {
    toolCalls: number;
    transportCalls: number;
    internalRequests: number;
    deduplicatedRequests: number;
    averageToolCalls: number;
    averageTransportCalls: number;
  };
  errors: readonly string[];
};
