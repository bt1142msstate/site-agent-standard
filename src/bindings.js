import { filterSiteAgentManifest } from "./manifest.js";

export const MCP_TASKS_EXTENSION_ID = "io.modelcontextprotocol/tasks";

function title(capability) {
  return capability.title || capability.id.split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function toolAnnotations(action) {
  return {
    title: title(action),
    readOnlyHint: action.risk === "read",
    destructiveHint: action.risk === "destructive",
    idempotentHint: action.reconciliation?.equivalent === "complete",
    openWorldHint: Boolean(action.openWorld || action.sideEffects?.includes("external")),
  };
}

function queryEvidenceSchema() {
  return {
    type: "object",
    required: ["completeness", "reasons", "provenance"],
    properties: {
      completeness: { enum: ["complete", "partial", "unknown"] },
      reasons: { type: "array", items: { type: "string" } },
      provenance: { type: "array", items: { type: "object" } },
    },
    additionalProperties: false,
  };
}

function queryOutputSchema(resource) {
  return {
    type: "object",
    required: ["resourceId", "status", "data", "items", "mode", "total", "summary", "nextCursor", "asOf", "evidence"],
    properties: {
      resourceId: { const: resource.id },
      status: { enum: ["succeeded", "partial"] },
      data: resource.resultSchema,
      items: { type: "array", items: { type: "object" } },
      mode: { type: "string" },
      total: { type: "number" },
      summary: { type: "string" },
      nextCursor: { type: ["string", "null"] },
      asOf: { type: ["string", "null"] },
      evidence: queryEvidenceSchema(),
    },
    additionalProperties: false,
  };
}

export function createMcpBinding(manifest, context = {}) {
  const filtered = filterSiteAgentManifest(manifest, context, { stripExtensions: true });
  const queryResources = filtered.queryResources.filter(({ status }) => status !== "sunset");
  const actions = filtered.actions.filter(({ status }) => status !== "sunset");
  const taskActions = actions.filter((action) => action.taskSupport !== "forbidden");
  const queryTools = queryResources.map((resource) => ({
    name: `query.${resource.id}`,
    title: title(resource),
    description: resource.description,
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: resource.modes },
        filters: { type: "object", properties: resource.filters, additionalProperties: false },
        sort: resource.sorts?.length ? { type: "string", enum: resource.sorts } : { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: resource.pagination?.maxLimit || resource.maxResults || 100 },
        cursor: { type: "string" },
        ...(resource.selectableFields?.length ? {
          select: { type: "array", uniqueItems: true, items: { type: "string", enum: resource.selectableFields } },
        } : {}),
      },
      additionalProperties: false,
    },
    outputSchema: queryOutputSchema(resource),
    annotations: { title: title(resource), readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { "site-agent/resource-id": resource.id },
  }));
  return Object.freeze({
    capabilities: taskActions.length ? {
      extensions: { [MCP_TASKS_EXTENSION_ID]: {} },
    } : { extensions: {} },
    taskContracts: taskActions.map((action) => ({
      actionId: action.id,
      support: action.taskSupport,
      extensionId: MCP_TASKS_EXTENSION_ID,
      serverDirected: true,
      methods: ["tasks/get", "tasks/update", "tasks/cancel"],
      listing: false,
    })),
    resourceTemplates: queryResources.map((resource) => ({
      uriTemplate: `site-agent://${manifest.id}/query/${resource.id}{?cursor}`,
      name: resource.id,
      title: title(resource),
      description: resource.description,
      mimeType: "application/json",
    })),
    tools: [...queryTools, ...actions.map((action) => ({
      name: `prepare.${action.id}`,
      title: title(action),
      description: `${action.description} This prepares a reviewable plan and does not bypass confirmation.`,
      inputSchema: action.inputSchema,
      outputSchema: {
        type: "object",
        required: ["actionId", "planId", "status", "confirmation", "expiresAt"],
        properties: {
          actionId: { const: action.id },
          planId: { type: "string" },
          status: { const: "prepared" },
          confirmation: { enum: ["none", "explicit", "typed"] },
          expiresAt: { type: "string" },
          preview: {},
          destination: { type: ["object", "null"] },
        },
      },
      annotations: toolAnnotations(action),
      _meta: {
        "site-agent/action-id": action.id,
        "site-agent/stage": "prepare",
        "site-agent/task-support": action.taskSupport || "forbidden",
      },
    }))],
  });
}

export async function registerWebMcpTools(options = {}) {
  const modelContext = options.modelContext || options.document?.modelContext;
  if (!modelContext?.registerTool) throw new Error("webmcp-model-context-unavailable");
  if (!options.agent) throw new TypeError("webmcp-agent-required");

  const exposedTo = options.exposedTo || [];
  const registrations = new Map();
  let active = true;
  let subscription = null;
  let pending = Promise.resolve();

  const describeExpandedQueryTools = (manifest) => manifest.queryResources.filter(({ status }) => status !== "sunset").map((resource) => ({
      key: `query.${resource.id}`,
      definition: {
      name: `query.${resource.id}`,
      title: title(resource),
      description: resource.description,
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: resource.modes },
          filters: { type: "object", properties: resource.filters, additionalProperties: false },
          sort: resource.sorts?.length ? { type: "string", enum: resource.sorts } : { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: resource.pagination?.maxLimit || resource.maxResults || 100 },
          cursor: { type: "string" },
          ...(resource.selectableFields?.length ? {
            select: { type: "array", uniqueItems: true, items: { type: "string", enum: resource.selectableFields } },
          } : {}),
        },
        additionalProperties: false,
      },
      outputSchema: queryOutputSchema(resource),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (request) => options.agent.query({ resourceId: resource.id, ...request }),
      },
    }));

  const describeBrokeredQueryTools = () => [{
    key: "site.find_queries",
    definition: {
      name: "site.find_queries",
      title: "Find site information sources",
      description: "Find the authorized Site Agent query resources most relevant to an information need before reading frontend, backend, or document-backed data.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", maxLength: 500 },
          needs: {
            type: "array",
            maxItems: 20,
            items: {
              type: "object",
              required: ["key", "text"],
              properties: { key: { type: "string", maxLength: 80 }, text: { type: "string", maxLength: 500 } },
              additionalProperties: false,
            },
          },
          execution: { type: "string", enum: ["local", "host"] },
          mode: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        required: ["text", "total", "resources"],
        properties: {
          text: { type: "string" },
          total: { type: "number" },
          resources: { type: "array", items: { type: "object" } },
          needs: { type: "array", items: { type: "object" } },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (request) => options.agent.findQueryResources(request),
    },
  }, {
    key: "site.query",
    definition: {
      name: "site.query",
      title: "Query site information",
      description: "Read one or up to twenty authorized Site Agent resources in one call. Batch every independent read needed for the answer; the host deduplicates compatible requests and reports completeness, provenance, and transport cost.",
      inputSchema: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          mode: { type: "string" },
          filters: { type: "object" },
          sort: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 1000 },
          cursor: { type: "string" },
          select: { type: "array", uniqueItems: true, items: { type: "string" } },
          requests: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: {
              type: "object",
              required: ["key", "resourceId"],
              properties: {
                key: { type: "string", maxLength: 80 },
                resourceId: { type: "string" },
                mode: { type: "string" },
                filters: { type: "object" },
                sort: { type: "string" },
                limit: { type: "integer", minimum: 1, maximum: 1000 },
                cursor: { type: "string" },
                select: { type: "array", uniqueItems: true, items: { type: "string" } },
              },
              additionalProperties: false,
            },
          },
          consistency: { type: "string", enum: ["independent", "snapshot"] },
        },
        anyOf: [{ required: ["resourceId"] }, { required: ["requests"] }],
        additionalProperties: false,
      },
      outputSchema: { type: "object" },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (request) => Array.isArray(request.requests)
        ? options.agent.queryBatch(request)
        : options.agent.query(request),
    },
  }];

  const describeTools = (manifest) => [
    ...(options.queryExposure === "brokered"
      || (!options.queryExposure && manifest.queryResources.length > Number(options.maxExpandedQueryTools || 24))
      ? describeBrokeredQueryTools()
      : describeExpandedQueryTools(manifest)),
    ...manifest.actions.filter(({ status }) => status !== "sunset").map((action) => ({
      key: `prepare.${action.id}`,
      definition: {
      name: `prepare.${action.id}`,
      title: title(action),
      description: `${action.description} The user reviews the returned plan before it can execute.`,
      inputSchema: action.inputSchema,
      annotations: {
        readOnlyHint: action.risk === "read",
        untrustedContentHint: Boolean(action.openWorld),
      },
      execute: (input) => options.agent.prepareAction({ actionId: action.id, input }),
      },
    })),
  ];

  const synchronize = (manifest) => {
    pending = pending.then(async () => {
      if (!active) return;
      const desired = new Map(describeTools(manifest).map((entry) => [entry.key, entry]));

      for (const [key, registration] of registrations) {
        const next = desired.get(key);
        const nextFingerprint = next ? JSON.stringify({ ...next.definition, execute: undefined }) : "";
        if (!next || nextFingerprint !== registration.fingerprint) {
          registration.controller.abort();
          registrations.delete(key);
        }
      }

      for (const [key, entry] of desired) {
        if (registrations.has(key)) continue;
        const controller = new AbortController();
        await modelContext.registerTool(entry.definition, { signal: controller.signal, exposedTo });
        registrations.set(key, {
          controller,
          fingerprint: JSON.stringify({ ...entry.definition, execute: undefined }),
        });
      }
    });
    return pending;
  };

  const initial = typeof options.agent.getCapabilitySnapshot === "function"
    ? (await options.agent.getCapabilitySnapshot()).manifest
    : await options.agent.getCapabilities();
  await synchronize(initial);

  if (typeof options.agent.subscribeCapabilitySnapshots === "function") {
    try {
      subscription = await options.agent.subscribeCapabilitySnapshots(({ manifest }) => synchronize(manifest));
      await pending;
    } catch (error) {
      if (!String(error?.message || error).includes("capability-subscription-not-supported")) throw error;
    }
  }

  return Object.freeze({
    get registeredToolNames() {
      return Object.freeze([...registrations.keys()].sort());
    },
    unregister() {
      active = false;
      subscription?.unsubscribe?.();
      for (const registration of registrations.values()) registration.controller.abort();
      registrations.clear();
    },
  });
}

export function createArazzoBinding(manifest, options = {}) {
  const sourceDescriptions = options.sourceDescriptions;
  const operationIds = options.operationIds || {};
  if (!Array.isArray(sourceDescriptions) || !sourceDescriptions.length) {
    throw new TypeError("arazzo-source-descriptions-required");
  }
  for (const source of sourceDescriptions) {
    if (!["openapi", "asyncapi", "arazzo"].includes(source?.type)) {
      throw new TypeError("arazzo-source-description-type-invalid");
    }
  }
  return {
    arazzo: "1.1.0",
    info: { title: `${manifest.name} Site Agent workflows`, version: manifest.manifestVersion || "0.1.0" },
    sourceDescriptions,
    workflows: (manifest.workflows || []).map((workflow) => ({
      workflowId: workflow.id,
      summary: workflow.description,
      steps: workflow.steps.map((step) => ({
        stepId: step.id,
        operationId: operationIds[step.capabilityId]
          || (() => { throw new TypeError(`arazzo-operation-id-missing:${step.capabilityId}`); })(),
        ...(step.onSuccess ? { successActions: [{ name: `continueTo_${step.onSuccess}`, type: "goto", stepId: step.onSuccess }] } : {}),
        ...(step.onFailure ? { failureActions: [{ name: `recoverAt_${step.onFailure}`, type: "goto", stepId: step.onFailure }] } : {}),
      })),
    })),
  };
}

export function createAsyncApiBinding(manifest) {
  const messages = Object.fromEntries((manifest.events || []).map((event) => [event.id, {
    name: event.id,
    title: title(event),
    summary: event.description,
    payload: event.payloadSchema,
  }]));
  const channels = Object.fromEntries((manifest.events || []).map((event) => [event.id, {
    address: null,
    messages: { [event.id]: { $ref: `#/components/messages/${event.id}` } },
  }]));
  const operations = Object.fromEntries((manifest.events || []).map((event) => [`receive.${event.id}`, {
    action: "receive",
    channel: { $ref: `#/channels/${event.id}` },
    messages: [{ $ref: `#/channels/${event.id}/messages/${event.id}` }],
  }]));
  return {
    asyncapi: "3.0.0",
    info: { title: `${manifest.name} Site Agent events`, version: manifest.manifestVersion || "0.1.0" },
    channels,
    operations,
    components: { messages },
  };
}
