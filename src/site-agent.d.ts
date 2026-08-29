export type SiteAgentProfile = "core" | "query" | "navigation" | "action" | "presentation" | "operability";
export type CapabilityVisibility = "public" | "authenticated";
export type TargetPrecision = "control" | "field" | "record" | "record-page" | "surface";
export type NavigationCandidatePrecision = "value" | "control" | "field" | "text" | "record" | "section" | "surface";
export type ActionRisk = "read" | "reversible" | "consequential" | "destructive";
export type ConfirmationKind = "none" | "explicit" | "typed";
export type ActionReconciliationStatus = "confirmed" | "already-applied" | "reconfirmation-required";
export type CapabilityStatus = "active" | "deprecated" | "sunset";
export type TaskSupport = "forbidden" | "optional" | "required";

export interface ActionReconciliationPolicy {
  identity: "stable-reference";
  equivalent: "complete";
  nonConflicting: "rebase" | "reconfirm";
  conflicting: "reconfirm" | "reject";
  missing: "complete-if-satisfied" | "reconfirm" | "reject";
}

export interface PermissionContract {
  permissionsAll?: string[];
  permissionsAny?: string[];
}

export interface SiteAgentCapability extends PermissionContract {
  id: string;
  title?: string;
  description: string;
  visibility: CapabilityVisibility;
  status?: CapabilityStatus;
  replacedBy?: string;
  sunsetAt?: string;
}

export interface QueryResource extends SiteAgentCapability {
  aliases?: string[];
  keywords?: string[];
  examples?: string[];
  execution: "local" | "host";
  modes: string[];
  modeCoverage?: Array<{ mode: string; covers: string[] }>;
  filters: Record<string, Record<string, unknown>>;
  selectableFields?: string[];
  defaultFields?: string[];
  sorts?: string[];
  maxResults?: number;
  resultSchema?: Record<string, unknown>;
  pagination?: { style: "none" | "cursor"; defaultLimit?: number; maxLimit?: number };
  freshness?: { mode: "static" | "snapshot" | "live"; maxAgeSeconds?: number; eventIds?: string[] };
  batching?: { group: string; maxSize: number; consistency: "independent" | "snapshot" };
  materialization?: {
    basis: "rendered-user-surface" | "canonical-structured-source" | "document-text" | "external";
    stage: "build" | "runtime" | "request";
    surfaceParity: "required" | "not-applicable";
    nestedContent: "resolved" | "not-applicable";
    nestedDestination: "exact-reveal-required" | "not-applicable";
  };
  aggregations?: Record<string, Record<string, unknown>>;
  relationships?: string[];
  destinationId?: string;
  resultTargetKind?: string;
}

export interface NavigationDestination extends SiteAgentCapability {
  route: string;
  precision: TargetPrecision;
  exact: true;
  targetKinds: string[];
  stateSchema?: Record<string, unknown>;
  reveal?: {
    mode: "nested";
    steps: Array<{
      id: string;
      kind: "route" | "state" | "nested-resource" | "target";
      description?: string;
      timeoutMs?: number;
      stateKeys?: string[];
      targetKinds?: string[];
    }>;
    verification: "each-step-and-final-target";
    outerSurfaceFallback: false;
  };
  targetSelection?: {
    order: NavigationCandidatePrecision[];
    oversized: "next-declared-candidate";
    requireFullyVisible: true;
    inferredDomFallback: false;
  };
}

export interface SiteAction extends SiteAgentCapability {
  risk: ActionRisk;
  confirmation: ConfirmationKind;
  reconciliation: ActionReconciliationPolicy;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  confirmationSchema?: Record<string, unknown>;
  taskSupport?: TaskSupport;
  sideEffects?: Array<"none" | "data" | "notification" | "file" | "financial" | "identity" | "external">;
  openWorld?: boolean;
  destinationId?: string;
}

export interface SiteAgentEvent extends SiteAgentCapability {
  payloadSchema: Record<string, unknown>;
}

export interface SiteAgentWorkflow extends SiteAgentCapability {
  actors?: Array<{
    id: string;
    role: string;
  }>;
  contexts?: Array<{
    id: string;
    actorId: string;
    kind: "client" | "operations";
  }>;
  synchronization?: {
    timeline: "shared-monotonic";
    barriers: "step-boundaries";
    recording: "all-contexts";
  };
  steps: Array<{
    id: string;
    capabilityId: string;
    actorId?: string;
    contextId?: string;
    dependsOn?: string[];
    onSuccess?: string;
    onFailure?: string;
  }>;
}

export interface SiteAgentManifest {
  $schema?: string;
  standardVersion: "0.1" | "0.2";
  manifestVersion?: string;
  capabilityRevision?: string;
  id: string;
  name: string;
  profiles: SiteAgentProfile[];
  queryResources: QueryResource[];
  navigationDestinations: NavigationDestination[];
  actions: SiteAction[];
  presentation?: {
    preset: string;
    cursor: string;
    cursorMotion: string;
    frameTarget: string;
    clickFeedback: string;
    clickSound: string;
    scrollMotion: string;
    inputPresentation: string;
    typingSound: string;
    responsiveVariants: string[];
    supportedThemes: string[];
    visualQuality: {
      source: "browser-computed-style";
      mappedStates: "all";
      viewports: "all-responsive-variants";
      themes: "all-supported";
      visibleLabels: "required";
      contrast: "wcag-2.2-aa";
    };
    muteSupported: boolean;
    reducedMotionSupported: boolean;
  };
  operability?: {
    evidenceSource: "independent-operability-run";
    coverage: "all-active-capabilities";
    viewports: string[];
    inputModes: Array<"keyboard" | "pointer" | "touch" | "programmatic" | "assistive-technology">;
    accessibilityRules: "act-compatible-automated-and-manual";
    wcagConformanceClaim: false;
    navigationBudgetMs: number;
    queryBudgetMs: number;
  };
  events?: SiteAgentEvent[];
  workflows?: SiteAgentWorkflow[];
  bindings?: Record<string, unknown>;
  conformance?: {
    claims?: SiteAgentProfile[];
    coverage?: { visibleSurfaces?: "complete" | "partial"; humanActions?: "complete" | "partial" };
  };
  [extension: `x-${string}`]: unknown;
}

export * from "./presentation.js";
export * from "./presentation-audio.js";
export * from "./rendered-quality.js";
export * from "./artifact-contract.js";
export * from "./tutorial-runtime.js";
export * from "./problem.js";
export * from "./execution.js";
export * from "./coverage.js";
export * from "./operability.js";
export * from "./query-quality.js";

export interface SiteAgentContext {
  authenticated: boolean;
  permissions: string[];
  actor?: unknown;
}

export interface SemanticDestination {
  destinationId: string;
  state?: Record<string, unknown>;
  target?: { reference: string; kind?: string };
}

export interface NavigationOutcome {
  exact: true;
  visible: true;
  targetKind?: string;
  reveal?: {
    complete: true;
    verifiedSteps: string[];
  };
}

export interface QueryRequest {
  key?: string;
  resourceId: string;
  mode?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  cursor?: string;
  select?: string[];
  signal?: AbortSignal;
  deadlineAt?: string | number;
  correlationId?: string;
}

export interface QueryDiscoveryRequest {
  text?: string;
  needs?: Array<{ key: string; text: string }>;
  mode?: string;
  execution?: "local" | "host";
  limit?: number;
}

export interface QueryDiscoveryResult {
  text: string;
  total: number;
  needs?: Array<{ key: string; text: string; resources: QueryDiscoveryResult["resources"] }>;
  resources: Array<{
    resourceId: string;
    title: string;
    description: string;
    execution: "local" | "host";
    modes: string[];
    filters: string[];
    sorts: string[];
    freshness: QueryResource["freshness"];
    destinationId: string | null;
    score: number;
  }>;
}

export interface QueryBatchRequest {
  requests: QueryRequest[];
  concurrency?: number;
  failFast?: boolean;
  consistency?: "independent" | "snapshot";
}

export interface QueryBatchResult {
  status: "succeeded" | "partial";
  results: Array<{ key: string; resourceId: string; status: "succeeded"; result: QueryResult } | { key: string; resourceId: string; status: "failed"; problem: unknown }>;
  metrics: { requested: number; executed: number; deduplicated: number; transportCalls: number; durationMs: number };
}

export interface CapabilitySnapshot {
  standardVersion: SiteAgentManifest["standardVersion"];
  manifestVersion: string;
  capabilityRevision: string;
  manifest: SiteAgentManifest;
}

export interface QueryItem {
  reference: string;
  label: string;
  fields: Record<string, unknown>;
  destination: SemanticDestination | null;
}

export interface QueryResult {
  resourceId: string;
  data: unknown;
  items: QueryItem[];
  mode: string;
  total: number;
  summary: string;
  status: "succeeded" | "partial";
  nextCursor: string | null;
  asOf: string | null;
  evidence: {
    completeness: "complete" | "partial" | "unknown";
    reasons: string[];
    provenance: Array<{ resourceId: string; asOf: string | null; revision: string | null; source?: string }>;
  };
}

export interface ActionPlan {
  actionId: string;
  planId: string;
  status: "prepared";
  confirmation: ConfirmationKind;
  expiresAt: string;
  preview?: unknown;
  destination?: SemanticDestination | null;
}

export interface ActionConfirmationResult {
  status: ActionReconciliationStatus | "working";
  reconciliation?: "unchanged" | "rebased" | "equivalent" | "conflicting" | "missing";
  replacementPlan?: ActionPlan;
  destination?: SemanticDestination | null;
}

export interface ActionTask {
  taskId: string;
  status: "working" | "input_required" | "completed" | "failed" | "cancelled";
  statusMessage?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  ttlMs?: number | null;
  pollIntervalMs?: number;
  inputRequests?: Record<string, unknown>;
  output?: unknown;
  error?: unknown;
}

export interface SiteAgentOptions {
  manifest: SiteAgentManifest;
  getManifest?: () => SiteAgentManifest | Promise<SiteAgentManifest>;
  subscribeCapabilities?: (listener: () => void) => (() => void) | { unsubscribe(): void } | Promise<(() => void) | { unsubscribe(): void }>;
  context?: SiteAgentContext;
  getContext?: () => SiteAgentContext | Promise<SiteAgentContext>;
  adapters: {
    query?: {
      execute(input: unknown): unknown | Promise<unknown>;
      executeBatch?(input: unknown): unknown | Promise<unknown>;
      subscribe?(input: unknown): unknown | Promise<unknown>;
    } | ((input: unknown) => unknown | Promise<unknown>);
    navigation?: { navigate(input: unknown): unknown | Promise<unknown> } | ((input: unknown) => unknown | Promise<unknown>);
    action?: {
      prepare(input: unknown): unknown | Promise<unknown>;
      confirm(input: unknown): unknown | Promise<unknown>;
      cancel(input: unknown): unknown | Promise<unknown>;
      getTask?(input: unknown): unknown | Promise<unknown>;
      updateTask?(input: unknown): unknown | Promise<unknown>;
      cancelTask?(input: unknown): unknown | Promise<unknown>;
    };
    presentation?: {
      mount(input: unknown): unknown | Promise<unknown>;
      move(input: unknown): unknown | Promise<unknown>;
      click(input: unknown): unknown | Promise<unknown>;
      type(input: unknown): unknown | Promise<unknown>;
      clear?(input: unknown): unknown | Promise<unknown>;
      destroy?(input: unknown): unknown | Promise<unknown>;
      setMuted?(muted: boolean): void;
    };
  };
  presentation?: { muted?: boolean };
  report?: (event: { profile: string; capabilityId: string; status: string; durationMs: number; failureCode: string }) => void;
}

export declare const SITE_AGENT_STANDARD_VERSION: "0.2";
export declare const SITE_AGENT_SUPPORTED_VERSIONS: readonly ["0.1", "0.2"];
export declare const SITE_AGENT_PROFILES: readonly SiteAgentProfile[];
export declare function negotiateSiteAgentVersion(
  offeredVersions: string | string[],
  supportedVersions?: readonly string[],
): string | null;
export declare function validateSiteAgentManifest(manifest: unknown, options?: { publicDocument?: boolean }): { valid: boolean; errors: string[] };
export declare function assertSiteAgentManifest(manifest: unknown, options?: { publicDocument?: boolean }): SiteAgentManifest;
export declare function isCapabilityAuthorized(capability: SiteAgentCapability, context: SiteAgentContext): boolean;
export declare function filterSiteAgentManifest(manifest: SiteAgentManifest, context: SiteAgentContext, options?: { stripExtensions?: boolean }): SiteAgentManifest;
export declare function createPublicDiscoveryManifest(manifest: SiteAgentManifest): SiteAgentManifest;
export declare function getSiteAgentConformance(manifest: SiteAgentManifest): { valid: boolean; errors: string[]; profiles: Record<SiteAgentProfile, boolean>; coverage: Record<string, string>; declaredComplete: boolean; declaredTutorialComplete: boolean; declaredOperabilityComplete: boolean; executionVerified: false; fullyConformant: false; tutorialConformant: false; operabilityConformant: false };
export declare function createSiteAgent(options: SiteAgentOptions): {
  manifest: SiteAgentManifest;
  getConformance(): ReturnType<typeof getSiteAgentConformance>;
  getCurrentConformance(): Promise<ReturnType<typeof getSiteAgentConformance>>;
  getCapabilities(): Promise<SiteAgentManifest>;
  getCapabilitySnapshot(): Promise<CapabilitySnapshot>;
  subscribeCapabilitySnapshots(listener: (snapshot: CapabilitySnapshot) => void | Promise<void>): Promise<{ unsubscribe(): void }>;
  subscribeCapabilities(listener: (manifest: SiteAgentManifest) => void): Promise<{ unsubscribe(): void }>;
  findQueryResources(request?: QueryDiscoveryRequest): Promise<QueryDiscoveryResult>;
  query(request: QueryRequest): Promise<QueryResult>;
  queryBatch(request: QueryBatchRequest): Promise<QueryBatchResult>;
  subscribe(request: QueryRequest, listener: (event: unknown) => void): Promise<{ unsubscribe(): void }>;
  navigate(intent: SemanticDestination & import("./execution.js").SiteAgentExecutionRequest): Promise<unknown>;
  prepareAction(request: { actionId: string; input?: unknown; target?: unknown } & import("./execution.js").SiteAgentExecutionRequest): Promise<ActionPlan>;
  confirmAction(request: { actionId: string; planId: string; confirmation?: unknown } & import("./execution.js").SiteAgentExecutionRequest): Promise<unknown>;
  cancelAction(request: { actionId: string; planId: string } & import("./execution.js").SiteAgentExecutionRequest): Promise<unknown>;
  getTask(request: { actionId: string; taskId: string } & import("./execution.js").SiteAgentExecutionRequest): Promise<ActionTask>;
  updateTask(request: { actionId: string; taskId: string; inputResponses: Record<string, unknown> } & import("./execution.js").SiteAgentExecutionRequest): Promise<{ acknowledged: true }>;
  cancelTask(request: { actionId: string; taskId: string } & import("./execution.js").SiteAgentExecutionRequest): Promise<{ acknowledged: true; task?: ActionTask }>;
};

export * from "./site-navigator.js";
export * from "./bindings.js";
export * from "./conformance.js";
