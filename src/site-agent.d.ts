export type SiteAgentProfile = "core" | "query" | "navigation" | "action";
export type CapabilityVisibility = "public" | "authenticated";
export type TargetPrecision = "control" | "field" | "record" | "record-page" | "surface";
export type ActionRisk = "read" | "reversible" | "consequential" | "destructive";
export type ConfirmationKind = "none" | "explicit" | "typed";

export interface PermissionContract {
  permissionsAll?: string[];
  permissionsAny?: string[];
}

export interface SiteAgentCapability extends PermissionContract {
  id: string;
  description: string;
  visibility: CapabilityVisibility;
}

export interface QueryResource extends SiteAgentCapability {
  execution: "local" | "host";
  modes: string[];
  filters: Record<string, Record<string, unknown>>;
  sorts?: string[];
  maxResults?: number;
  resultSchema?: Record<string, unknown>;
  destinationId?: string;
}

export interface NavigationDestination extends SiteAgentCapability {
  route: string;
  precision: TargetPrecision;
  exact: true;
  targetKinds: string[];
  stateSchema?: Record<string, unknown>;
}

export interface SiteAction extends SiteAgentCapability {
  risk: ActionRisk;
  confirmation: ConfirmationKind;
  inputSchema: Record<string, unknown>;
  destinationId?: string;
}

export interface SiteAgentManifest {
  $schema?: string;
  standardVersion: "0.1";
  id: string;
  name: string;
  profiles: SiteAgentProfile[];
  queryResources: QueryResource[];
  navigationDestinations: NavigationDestination[];
  actions: SiteAction[];
  conformance?: {
    claims?: SiteAgentProfile[];
    coverage?: { visibleSurfaces?: "complete" | "partial"; humanActions?: "complete" | "partial" };
  };
  [extension: `x-${string}`]: unknown;
}

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

export interface QueryRequest {
  resourceId: string;
  mode?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  limit?: number;
}

export interface QueryItem {
  reference: string;
  label: string;
  fields: Record<string, unknown>;
  destination: SemanticDestination | null;
}

export interface QueryResult {
  items: QueryItem[];
  mode: string;
  total: number;
  summary: string;
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

export interface SiteAgentOptions {
  manifest: SiteAgentManifest;
  context?: SiteAgentContext;
  getContext?: () => SiteAgentContext | Promise<SiteAgentContext>;
  adapters: {
    query?: { execute(input: unknown): unknown | Promise<unknown> } | ((input: unknown) => unknown | Promise<unknown>);
    navigation?: { navigate(input: unknown): unknown | Promise<unknown> } | ((input: unknown) => unknown | Promise<unknown>);
    action?: {
      prepare(input: unknown): unknown | Promise<unknown>;
      confirm(input: unknown): unknown | Promise<unknown>;
      cancel(input: unknown): unknown | Promise<unknown>;
    };
  };
  report?: (event: { profile: string; capabilityId: string; status: string; durationMs: number; failureCode: string }) => void;
}

export declare const SITE_AGENT_STANDARD_VERSION: "0.1";
export declare const SITE_AGENT_PROFILES: readonly SiteAgentProfile[];
export declare function validateSiteAgentManifest(manifest: unknown, options?: { publicDocument?: boolean }): { valid: boolean; errors: string[] };
export declare function assertSiteAgentManifest(manifest: unknown, options?: { publicDocument?: boolean }): SiteAgentManifest;
export declare function isCapabilityAuthorized(capability: SiteAgentCapability, context: SiteAgentContext): boolean;
export declare function filterSiteAgentManifest(manifest: SiteAgentManifest, context: SiteAgentContext, options?: { stripExtensions?: boolean }): SiteAgentManifest;
export declare function createPublicDiscoveryManifest(manifest: SiteAgentManifest): SiteAgentManifest;
export declare function getSiteAgentConformance(manifest: SiteAgentManifest): { valid: boolean; errors: string[]; profiles: Record<SiteAgentProfile, boolean>; coverage: Record<string, string>; fullyConformant: boolean };
export declare function createSiteAgent(options: SiteAgentOptions): {
  manifest: SiteAgentManifest;
  getConformance(): ReturnType<typeof getSiteAgentConformance>;
  getCapabilities(): Promise<SiteAgentManifest>;
  query(request: QueryRequest): Promise<QueryResult>;
  navigate(intent: SemanticDestination): Promise<unknown>;
  prepareAction(request: { actionId: string; input?: unknown; target?: unknown }): Promise<ActionPlan>;
  confirmAction(request: { actionId: string; planId: string; confirmation?: unknown }): Promise<unknown>;
  cancelAction(request: { actionId: string; planId: string }): Promise<unknown>;
};

export * from "./site-navigator.js";
