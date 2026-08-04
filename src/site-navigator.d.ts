export interface NavigationDescriptor {
  target: Element;
  focusTarget?: HTMLElement;
  highlightTarget?: HTMLElement;
  exact?: boolean;
  kind?: string;
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
  hasIntent?: () => boolean;
  activate?: () => void;
  resolve: () => NavigationDescriptor | null;
  report?: (state: string, descriptor?: NavigationDescriptor | null) => void;
  focusTarget?: typeof focusVerifiedNavigationTarget;
  focusOptions?: Omit<FocusNavigationOptions, "target">;
  observedAttributes?: string[];
}

export declare const verifiedNavigationRuntime: "esm";
export declare function isVerifiedNavigationTargetVisible(options: FocusNavigationOptions): boolean;
export declare function focusVerifiedNavigationTarget(options: FocusNavigationOptions): boolean;
export declare function createVerifiedNavigationController(options: NavigationControllerOptions): {
  attempt(): void;
  start(): boolean;
  stop(): void;
};
