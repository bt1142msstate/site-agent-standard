import {
  assertSiteAgentManifest,
  filterSiteAgentManifest,
  getSiteAgentConformance,
  isCapabilityAuthorized,
} from "./manifest.js";

export * from "./manifest.js";
export * from "./site-navigator.js";
export * from "./navigation-progress.js";

function now() {
  return Date.now();
}

function requiredAdapter(adapter, profile) {
  if (!adapter) throw new Error(`${profile}-adapter-required`);
  return adapter;
}

function findCapability(values, id, profile) {
  const capability = values.find((value) => value.id === id);
  if (!capability) throw new Error(`${profile}-capability-not-found`);
  return capability;
}

function assertAuthorized(capability, context) {
  if (!isCapabilityAuthorized(capability, context)) throw new Error("capability-not-authorized");
}

function validateSemanticDestination(destination, manifest) {
  if (!destination) return null;
  if (!destination.destinationId || !manifest.navigationDestinations.some(({ id }) => id === destination.destinationId)) {
    throw new Error("invalid-destination-reference");
  }
  const serialized = JSON.stringify(destination);
  if (/"(?:url|selector|firestorePath|storagePath|documentPath|collectionPath)"\s*:/.test(serialized)) {
    throw new Error("unsafe-destination-field");
  }
  return destination;
}

function safeTelemetry(report, event) {
  if (typeof report !== "function") return;
  report(Object.freeze({
    profile: event.profile,
    capabilityId: event.capabilityId,
    status: event.status,
    durationMs: event.durationMs,
    failureCode: event.failureCode || "",
  }));
}

export function createSiteAgent(options = {}) {
  const manifest = assertSiteAgentManifest(options.manifest);
  const adapters = options.adapters || {};
  const consumedPlans = new Set();
  const getContext = async () => {
    const context = typeof options.getContext === "function" ? await options.getContext() : (options.context || {});
    return { authenticated: Boolean(context.authenticated), permissions: [...new Set(context.permissions || [])], actor: context.actor || null };
  };

  async function invoke(profile, capabilityId, operation) {
    const startedAt = now();
    try {
      const value = await operation();
      safeTelemetry(options.report, { profile, capabilityId, status: "succeeded", durationMs: now() - startedAt });
      return value;
    } catch (error) {
      safeTelemetry(options.report, {
        profile,
        capabilityId,
        status: "failed",
        durationMs: now() - startedAt,
        failureCode: String(error?.message || "failed").slice(0, 120),
      });
      throw error;
    }
  }

  return Object.freeze({
    manifest,
    getConformance: () => getSiteAgentConformance(manifest),
    async getCapabilities() {
      return filterSiteAgentManifest(manifest, await getContext(), { stripExtensions: true });
    },
    async query(request = {}) {
      return invoke("query", request.resourceId, async () => {
        const context = await getContext();
        const resource = findCapability(manifest.queryResources, request.resourceId, "query");
        assertAuthorized(resource, context);
        const mode = request.mode || resource.modes[0];
        if (!resource.modes.includes(mode)) throw new Error("query-mode-not-supported");
        const filters = request.filters || {};
        for (const key of Object.keys(filters)) {
          if (!Object.hasOwn(resource.filters, key)) throw new Error(`query-filter-not-supported:${key}`);
        }
        if (request.sort && !(resource.sorts || []).includes(request.sort)) throw new Error("query-sort-not-supported");
        const limit = Math.min(Math.max(Number(request.limit || resource.maxResults || 25), 1), Number(resource.maxResults || 100));
        const adapter = requiredAdapter(adapters.query?.execute || adapters.query, "query");
        const raw = await adapter({ context, request: { ...request, filters, limit, mode }, resource });
        const items = Array.isArray(raw?.items) ? raw.items.map((item) => {
          if (!item || typeof item.reference !== "string" || !item.reference.trim()) throw new Error("invalid-query-result-reference");
          return {
            reference: item.reference,
            label: String(item.label || "").slice(0, 240),
            fields: item.fields && typeof item.fields === "object" ? item.fields : {},
            destination: validateSemanticDestination(item.destination || (resource.destinationId ? {
              destinationId: resource.destinationId,
              state: item.destinationState || {},
              target: { reference: item.reference },
            } : null), manifest),
          };
        }) : [];
        return { items, mode, total: Number.isFinite(raw?.total) ? raw.total : items.length, summary: String(raw?.summary || "").slice(0, 1000) };
      });
    },
    async navigate(intent = {}) {
      return invoke("navigation", intent.destinationId, async () => {
        const context = await getContext();
        const destination = findCapability(manifest.navigationDestinations, intent.destinationId, "navigation");
        assertAuthorized(destination, context);
        validateSemanticDestination(intent, manifest);
        const adapter = requiredAdapter(adapters.navigation?.navigate || adapters.navigation, "navigation");
        const outcome = await adapter({ context, destination, intent });
        if (!outcome || outcome.exact !== true || outcome.visible !== true) throw new Error("navigation-target-not-verified");
        return outcome;
      });
    },
    async prepareAction(request = {}) {
      return invoke("action", request.actionId, async () => {
        const context = await getContext();
        const action = findCapability(manifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        const adapter = requiredAdapter(adapters.action?.prepare, "action-prepare");
        const plan = await adapter({ action, context, request });
        if (!plan?.planId || plan.status !== "prepared" || !plan.expiresAt) throw new Error("invalid-action-plan");
        if (action.confirmation !== "none" && plan.confirmation !== action.confirmation) throw new Error("invalid-action-confirmation");
        return { ...plan, actionId: action.id, destination: validateSemanticDestination(plan.destination, manifest) };
      });
    },
    async confirmAction(request = {}) {
      return invoke("action", request.actionId, async () => {
        if (consumedPlans.has(request.planId)) throw new Error("action-plan-already-consumed");
        const context = await getContext();
        const action = findCapability(manifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        const adapter = requiredAdapter(adapters.action?.confirm, "action-confirm");
        const result = await adapter({ action, context, request });
        if (!result || result.status !== "confirmed") throw new Error("action-confirmation-failed");
        consumedPlans.add(request.planId);
        return { ...result, destination: validateSemanticDestination(result.destination, manifest) };
      });
    },
    async cancelAction(request = {}) {
      return invoke("action", request.actionId, async () => {
        const context = await getContext();
        const action = findCapability(manifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        const adapter = requiredAdapter(adapters.action?.cancel, "action-cancel");
        const result = await adapter({ action, context, request });
        if (!result || result.status !== "canceled") throw new Error("action-cancel-failed");
        consumedPlans.add(request.planId);
        return result;
      });
    },
  });
}
