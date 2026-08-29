import type { SiteAgentManifest, SiteAgentContext } from "./site-agent.js";

export declare function createMcpBinding(manifest: SiteAgentManifest, context?: SiteAgentContext): {
  capabilities: { extensions: Record<string, Record<string, never>> };
  taskContracts: unknown[];
  resourceTemplates: unknown[];
  tools: unknown[];
};
export declare const MCP_TASKS_EXTENSION_ID: "io.modelcontextprotocol/tasks";
export declare function registerWebMcpTools(options: {
  document?: Document & { modelContext?: unknown };
  modelContext?: unknown;
  agent: unknown;
  exposedTo?: string[];
  queryExposure?: "expanded" | "brokered";
  maxExpandedQueryTools?: number;
}): Promise<{ readonly registeredToolNames: readonly string[]; unregister(): void }>;
export declare function createArazzoBinding(manifest: SiteAgentManifest, options: {
  sourceDescriptions: Array<{ name: string; type: "openapi" | "asyncapi" | "arazzo"; url: string }>;
  operationIds: Record<string, string>;
}): Record<string, unknown>;
export declare function createAsyncApiBinding(manifest: SiteAgentManifest): Record<string, unknown>;
