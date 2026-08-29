import type { NavigationDestination, SemanticDestination } from "./site-agent.js";
import type { SiteAgentExecutionContext } from "./execution.js";

export interface RevealStepContext {
  destination: NavigationDestination;
  execution?: SiteAgentExecutionContext;
  index: number;
  intent: SemanticDestination;
  step: NonNullable<NavigationDestination["reveal"]>["steps"][number];
  verifiedSteps: readonly string[];
}

export interface RevealStepVerification {
  verified: boolean;
  exact?: boolean;
  visible?: boolean;
  targetKind?: string;
  [key: string]: unknown;
}

export interface NavigationRevealAdapter {
  activateRoute?(context: RevealStepContext): void | Promise<void>;
  applyState?(context: RevealStepContext): void | Promise<void>;
  revealResource?(context: RevealStepContext): void | Promise<void>;
  revealTarget?(context: RevealStepContext): void | Promise<void>;
  revealStep?(context: RevealStepContext): void | Promise<void>;
  verifyStep(context: RevealStepContext): boolean | RevealStepVerification | Promise<boolean | RevealStepVerification>;
}

export declare function runNavigationReveal(options: {
  destination: NavigationDestination;
  intent: SemanticDestination;
  adapter: NavigationRevealAdapter;
  execution?: SiteAgentExecutionContext;
  signal?: AbortSignal;
  stepTimeoutMs?: number;
  pollIntervalMs?: number;
  onStep?: (event: { index: number; step: RevealStepContext["step"]; verification: RevealStepVerification; verifiedSteps: string[] }) => void;
}): Promise<RevealStepVerification & {
  exact: true;
  visible: true;
  reveal: { complete: true; verifiedSteps: readonly string[] };
}>;
