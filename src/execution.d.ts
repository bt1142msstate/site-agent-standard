export interface SiteAgentExecutionRequest {
  signal?: AbortSignal;
  deadlineAt?: string | number;
  correlationId?: string;
}

export interface SiteAgentExecutionContext {
  readonly signal: AbortSignal | null;
  readonly deadlineAt: string | null;
  readonly correlationId: string;
  readonly remainingMs: number | null;
  assertActive(): void;
}

export declare function createExecutionContext(request?: SiteAgentExecutionRequest): SiteAgentExecutionContext;
