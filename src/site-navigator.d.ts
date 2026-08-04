export interface NavigationDescriptor {
  target: Element;
  focusTarget?: HTMLElement;
  highlightTarget?: HTMLElement;
  exact?: boolean;
  kind?: string;
}

export interface NavigationIntent<State = unknown> {
  id?: string;
  route?: string;
  state?: State;
  target?: unknown;
}

export interface NavigationAdapterContext<Intent extends NavigationIntent = NavigationIntent> {
  attempt: number;
  document: Document;
  intent: Intent;
  window: Window;
}

export interface NavigationStateVerification {
  verified: boolean;
  reason?: string;
}

export interface SiteNavigationAdapter<Intent extends NavigationIntent = NavigationIntent> {
  getIntent(): Intent | null;
  activate(context: NavigationAdapterContext<Intent>): void | Promise<void>;
  applyState(context: NavigationAdapterContext<Intent>): void | Promise<void>;
  isReady(context: NavigationAdapterContext<Intent>): boolean | Promise<boolean>;
  verifyState(context: NavigationAdapterContext<Intent>): boolean | NavigationStateVerification | Promise<boolean | NavigationStateVerification>;
  resolveTarget(context: NavigationAdapterContext<Intent>): NavigationDescriptor | null | Promise<NavigationDescriptor | null>;
}

export interface NavigationOutcome {
  target: Element;
  focusTarget: HTMLElement;
  highlightTarget: HTMLElement;
  visible: boolean;
  reason: "visible" | "target-replaced" | "outside-visible-region" | string;
}

export interface FocusNavigationOptions {
  target: HTMLElement;
  focusTarget?: HTMLElement;
  highlightTarget?: HTMLElement;
  windowRef?: Window;
  headerSelector?: string;
  highlightClass?: string;
  stateAttribute?: string;
  highlightDurationMs?: number;
  margin?: number;
  maxAttempts?: number;
  verifyHitTarget?: boolean;
  onSettled?: (outcome: NavigationOutcome) => void;
}

export interface NavigationControllerOptions {
  windowRef?: Window;
  documentRef?: Document;
  timeoutMs?: number;
  adapter: SiteNavigationAdapter;
  report?: (state: string, descriptor?: NavigationDescriptor | null) => void;
  focusTarget?: typeof focusVerifiedNavigationTarget;
  focusOptions?: Omit<FocusNavigationOptions, "target">;
  observedAttributes?: string[];
}

export declare function isVerifiedNavigationTargetVisible(options: FocusNavigationOptions): boolean;
export declare function focusVerifiedNavigationTarget(options: FocusNavigationOptions): boolean;
export declare const NAVIGATION_FAILURES: Readonly<{
  adapterRequired: "adapter-required";
  inexactTarget: "inexact-target";
  stateNotVerified: "state-not-verified";
  targetNotFound: "target-not-found";
  timedOut: "timed-out";
}>;
export declare function createSiteNavigator(options: NavigationControllerOptions): {
  attempt(): void;
  start(): boolean;
  stop(): void;
};
export declare const createVerifiedNavigationController: typeof createSiteNavigator;
