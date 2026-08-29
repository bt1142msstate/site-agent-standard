export interface ActionQualityStep {
  capabilityId: string;
  kind: "query" | "navigation" | "action";
  dependsOn?: string | null;
  confirmationRequired?: boolean;
  mutationCount?: number;
}

export interface ObservedActionQualityStep extends ActionQualityStep {
  authorized: boolean;
  confirmationPresented?: boolean;
  confirmed?: boolean;
  status: "prepared" | "input_required" | "completed" | "failed" | "cancelled";
  postconditionVerified?: boolean;
  failureDisclosed?: boolean;
  partialEffects?: boolean;
  partialEffectsDisclosed?: boolean;
}

export interface ActionQualityCase {
  id: string;
  requestedSteps: ActionQualityStep[];
  observedSteps: ObservedActionQualityStep[];
  permissionFiltered: boolean;
  idempotencyVerified: boolean;
  truthfulSummary: boolean;
  finalStatus?: "completed" | "failed" | "cancelled" | "input_required";
  terminalStable?: boolean;
  toolCalls: number;
  transportCalls: number;
  durationMs: number;
}

export declare function evaluateActionQuality(
  evidence: { cases: ActionQualityCase[] },
  budgets?: {
    maxToolCallsPerRequest?: number;
    maxTransportCallsPerRequest?: number;
    maxDurationMs?: number;
    minimumPassRatePercent?: number;
  },
): {
  valid: boolean;
  readiness: "ready" | "not-ready";
  cases: { passed: number; total: number; passRatePercent: number };
  steps: { verified: number; expected: number; accuracyPercent: number };
  requests: { toolCalls: number; transportCalls: number; averageToolCalls: number; averageTransportCalls: number };
  errors: readonly string[];
};
