export type SiteAgentProblemCategory = "invalid" | "denied" | "conflict" | "cancelled" | "timeout" | "unavailable" | "failed";
export type SiteAgentPartialEffects = "none" | "possible" | "applied" | "unknown";
export type SiteAgentRemediation = "none" | "revise-input" | "request-permission" | "reprepare" | "retry";

export interface SiteAgentProblemInput {
  code?: string;
  message?: string;
  title?: string;
  detail?: string;
  category?: SiteAgentProblemCategory;
  retryable?: boolean;
  partialEffects?: SiteAgentPartialEffects;
  requiredPermissions?: string[];
  remediation?: SiteAgentRemediation;
  correlationId?: string;
  cause?: unknown;
}

export declare class SiteAgentProblem extends Error {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly category: SiteAgentProblemCategory;
  readonly retryable: boolean;
  readonly partialEffects: SiteAgentPartialEffects;
  readonly requiredPermissions: readonly string[];
  readonly remediation: SiteAgentRemediation;
  readonly correlationId: string;
  constructor(input?: SiteAgentProblemInput);
  toJSON(): Readonly<Record<string, unknown>>;
}

export declare function toSiteAgentProblem(error: unknown, defaults?: SiteAgentProblemInput): SiteAgentProblem;
