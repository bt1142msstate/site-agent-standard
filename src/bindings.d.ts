import type { SiteAgentManifest, SiteAgentContext } from "./site-agent.js";

export declare function createMcpBinding(manifest: SiteAgentManifest, context?: SiteAgentContext): {
  resourceTemplates: unknown[];
  tools: unknown[];
};
export declare function registerWebMcpTools(options: {
  document: Document & { modelContext?: unknown };
  agent: unknown;
  exposedTo?: string[];
}): Promise<{ unregister(): void }>;
export declare function createArazzoBinding(manifest: SiteAgentManifest, options: {
  sourceDescriptions: Array<{ name: string; type: "openapi" | "asyncapi" | "arazzo"; url: string }>;
  operationIds: Record<string, string>;
}): Record<string, unknown>;
export declare function createAsyncApiBinding(manifest: SiteAgentManifest): Record<string, unknown>;
