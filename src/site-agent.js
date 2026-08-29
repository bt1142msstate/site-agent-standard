import {
  assertSiteAgentManifest,
  filterSiteAgentManifest,
  getSiteAgentConformance,
  isCapabilityAuthorized,
} from "./manifest.js";
import { assertSchemaValue } from "./schema-validation.js";
import { createPresentationController } from "./presentation.js";
import { createExecutionContext } from "./execution.js";
import { SiteAgentProblem, toSiteAgentProblem } from "./problem.js";
import { runNavigationReveal } from "./navigation-reveal.js";

export * from "./manifest.js";
export * from "./site-navigator.js";
export * from "./navigation-progress.js";
export * from "./bindings.js";
export * from "./conformance.js";
export * from "./presentation.js";
export * from "./rendered-quality.js";
export * from "./artifact-contract.js";
export * from "./tutorial-runtime.js";
export * from "./problem.js";
export * from "./execution.js";
export * from "./coverage.js";
export * from "./navigation-reveal.js";
export * from "./operability.js";

function now() {
  return Date.now();
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function searchTokens(value) {
  return [...new Set(normalizeSearchText(value).split(/\s+/).filter((token) => token.length > 1))];
}

function queryResourceScore(resource, text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) return 1;
  const tokens = searchTokens(normalized);
  const fields = [
    [resource.id, 12],
    [resource.title, 10],
    [(resource.aliases || []).join(" "), 9],
    [(resource.keywords || []).join(" "), 7],
    [Object.keys(resource.filters || {}).join(" "), 6],
    [(resource.examples || []).join(" "), 5],
    [resource.description, 3],
    [(resource.modes || []).join(" "), 2],
  ].map(([value, weight]) => [normalizeSearchText(value), weight]);
  let score = 0;
  for (const [value, weight] of fields) {
    if (!value) continue;
    if (value === normalized) score += weight * 4;
    else if (value.includes(normalized)) score += weight * 2;
    for (const token of tokens) {
      if (value.split(" ").includes(token)) score += weight;
      else if (value.includes(token)) score += weight * 0.4;
    }
  }
  return Math.round(score * 100) / 100;
}

function describeQueryResource(resource, score) {
  return Object.freeze({
    resourceId: resource.id,
    title: resource.title || resource.id,
    description: resource.description,
    execution: resource.execution,
    modes: Object.freeze([...(resource.modes || [])]),
    filters: Object.freeze(Object.keys(resource.filters || {})),
    sorts: Object.freeze([...(resource.sorts || [])]),
    freshness: resource.freshness ? Object.freeze({ ...resource.freshness }) : null,
    destinationId: resource.destinationId || null,
    score,
  });
}

function requiredAdapter(adapter, profile) {
  if (!adapter) throw new Error(`${profile}-adapter-required`);
  return adapter;
}

function findCapability(values, id, profile) {
  const capability = values.find((value) => value.id === id);
  if (!capability) throw new Error(`${profile}-capability-not-found`);
  if (capability.status === "sunset") throw new Error(`${profile}-capability-sunset`);
  return capability;
}

function assertAuthorized(capability, context) {
  if (!isCapabilityAuthorized(capability, context)) {
    throw new SiteAgentProblem({
      code: "capability-not-authorized",
      category: "denied",
      remediation: "request-permission",
      requiredPermissions: [...(capability.permissionsAll || []), ...(capability.permissionsAny || [])],
    });
  }
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

function assertNestedRevealIntent(intent, destination) {
  if (destination?.reveal?.mode !== "nested") return;
  const target = intent?.target;
  if (!target?.reference || !target?.kind) throw new Error("nested-destination-exact-target-required");
  if (!destination.targetKinds.includes(target.kind)) throw new Error("nested-destination-target-kind-invalid");
  for (const step of destination.reveal.steps || []) {
    if (step.kind !== "state") continue;
    for (const key of step.stateKeys || []) {
      if (!Object.hasOwn(intent.state || {}, key)) throw new Error(`nested-destination-state-required:${key}`);
    }
  }
}

function assertNestedRevealOutcome(outcome, intent, destination) {
  if (destination?.reveal?.mode !== "nested") return;
  if (outcome?.reveal?.complete !== true) throw new Error("nested-destination-reveal-not-complete");
  const verified = new Set(outcome.reveal.verifiedSteps || []);
  for (const step of destination.reveal.steps || []) {
    if (!verified.has(step.id)) throw new Error(`nested-destination-step-not-verified:${step.id}`);
  }
  if (outcome.targetKind !== intent.target.kind) throw new Error("nested-destination-final-target-not-verified");
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

const taskStatuses = new Set(["working", "input_required", "completed", "failed", "cancelled"]);

function normalizeActionTask(task, action) {
  if (!task || typeof task.taskId !== "string" || !task.taskId.trim()) throw new Error("invalid-action-task");
  const status = task.status === "canceled" ? "cancelled" : task.status;
  if (!taskStatuses.has(status)) throw new Error("invalid-action-task");
  if (status === "input_required") {
    if (!task.inputRequests || typeof task.inputRequests !== "object" || Array.isArray(task.inputRequests)) {
      throw new Error("invalid-action-task-input-requests");
    }
  }
  const output = task.output ?? task.result;
  if (status === "completed" && action.outputSchema) {
    assertSchemaValue(action.outputSchema, output || {}, "action-output");
  }
  return Object.freeze({ ...task, status, ...(output === undefined ? {} : { output }) });
}

export function createSiteAgent(options = {}) {
  const manifest = assertSiteAgentManifest(options.manifest);
  const adapters = options.adapters || {};
  const consumedPlans = new Set();
  const preparedPlans = new Map();
  const getContext = async () => {
    const context = typeof options.getContext === "function" ? await options.getContext() : (options.context || {});
    return { authenticated: Boolean(context.authenticated), permissions: [...new Set(context.permissions || [])], actor: context.actor || null };
  };
  const getManifest = async () => assertSiteAgentManifest(
    typeof options.getManifest === "function" ? await options.getManifest() : manifest,
  );
  const presentation = manifest.profiles.includes("presentation")
    ? createPresentationController({
      adapter: adapters.presentation,
      preset: manifest.presentation,
      muted: options.presentation?.muted,
      report: options.report,
    })
    : null;

  async function invoke(profile, capabilityId, request, operation) {
    const startedAt = now();
    try {
      const execution = createExecutionContext(request);
      const value = await operation(execution);
      safeTelemetry(options.report, { profile, capabilityId, status: "succeeded", durationMs: now() - startedAt });
      return value;
    } catch (error) {
      const problem = toSiteAgentProblem(error, { correlationId: request?.correlationId });
      safeTelemetry(options.report, {
        profile,
        capabilityId,
        status: "failed",
        durationMs: now() - startedAt,
        failureCode: problem.code,
      });
      throw problem;
    }
  }

  async function getCapabilitySnapshot() {
    const currentManifest = await getManifest();
    const filteredManifest = filterSiteAgentManifest(currentManifest, await getContext(), { stripExtensions: true });
    return Object.freeze({
      standardVersion: filteredManifest.standardVersion,
      manifestVersion: filteredManifest.manifestVersion,
      capabilityRevision: filteredManifest.capabilityRevision,
      manifest: filteredManifest,
    });
  }

  async function subscribeCapabilitySnapshots(listener) {
    if (typeof listener !== "function") throw new TypeError("capability-listener-required");
    if (typeof options.subscribeCapabilities !== "function") throw new Error("capability-subscription-not-supported");
    let active = true;
    let pending = Promise.resolve();
    const emit = () => {
      pending = pending.then(async () => {
        if (active) await listener(await getCapabilitySnapshot());
      });
      return pending;
    };
    const result = await options.subscribeCapabilities(emit);
    const unsubscribe = typeof result === "function" ? result : result?.unsubscribe;
    if (typeof unsubscribe !== "function") throw new Error("capability-subscription-invalid");
    await emit();
    return Object.freeze({
      unsubscribe() {
        active = false;
        unsubscribe();
      },
    });
  }

  const api = {
    manifest,
    presentation,
    getConformance: () => getSiteAgentConformance(manifest),
    getCurrentConformance: async () => getSiteAgentConformance(await getManifest()),
    async getCapabilities() {
      return (await getCapabilitySnapshot()).manifest;
    },
    getCapabilitySnapshot,
    subscribeCapabilitySnapshots,
    async subscribeCapabilities(listener) {
      return subscribeCapabilitySnapshots(({ manifest: currentManifest }) => listener(currentManifest));
    },
    async findQueryResources(request = {}) {
      return invoke("query", "query-catalog", request, async () => {
        const currentManifest = await getManifest();
        const filtered = filterSiteAgentManifest(currentManifest, await getContext(), { stripExtensions: true });
        const text = String(request.text || "").slice(0, 500);
        const maximum = Math.min(Math.max(Number(request.limit || 8), 1), 50);
        const resources = filtered.queryResources
          .filter(({ status }) => status !== "sunset")
          .filter((resource) => !request.execution || resource.execution === request.execution)
          .filter((resource) => !request.mode || resource.modes.includes(request.mode))
          .map((resource) => ({ resource, score: queryResourceScore(resource, text) }))
          .filter(({ score }) => !text.trim() || score > 0)
          .sort((left, right) => right.score - left.score
            || left.resource.id.localeCompare(right.resource.id));
        return Object.freeze({
          text,
          total: resources.length,
          resources: Object.freeze(resources.slice(0, maximum)
            .map(({ resource, score }) => describeQueryResource(resource, score))),
        });
      });
    },
    async query(request = {}) {
      return invoke("query", request.resourceId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const resource = findCapability(currentManifest.queryResources, request.resourceId, "query");
        assertAuthorized(resource, context);
        const mode = request.mode || resource.modes[0];
        if (!resource.modes.includes(mode)) throw new Error("query-mode-not-supported");
        const filters = request.filters || {};
        for (const key of Object.keys(filters)) {
          if (!Object.hasOwn(resource.filters, key)) throw new Error(`query-filter-not-supported:${key}`);
        }
        assertSchemaValue({
          type: "object",
          properties: resource.filters,
          additionalProperties: false,
        }, filters, "query-filters");
        if (request.sort && !(resource.sorts || []).includes(request.sort)) throw new Error("query-sort-not-supported");
        const pagination = resource.pagination || { style: "none", defaultLimit: resource.maxResults || 25, maxLimit: resource.maxResults || 100 };
        if (request.cursor && pagination.style !== "cursor") throw new Error("query-cursor-not-supported");
        const maximum = Number(pagination.maxLimit || resource.maxResults || 100);
        const limit = Math.min(Math.max(Number(request.limit || pagination.defaultLimit || resource.maxResults || 25), 1), maximum);
        const adapter = requiredAdapter(adapters.query?.execute || adapters.query, "query");
        execution.assertActive();
        const raw = await adapter({ context, execution, request: { ...request, filters, limit, mode }, resource });
        if (resource.resultSchema) assertSchemaValue(resource.resultSchema, raw, "query-result");
        const items = Array.isArray(raw?.items) ? raw.items.map((item) => {
          if (!item || typeof item.reference !== "string" || !item.reference.trim()) throw new Error("invalid-query-result-reference");
          const declaredDestination = resource.destinationId
            ? currentManifest.navigationDestinations.find(({ id }) => id === resource.destinationId)
            : null;
          const inferredTargetKind = resource.resultTargetKind
            || (declaredDestination?.targetKinds?.length === 1 ? declaredDestination.targetKinds[0] : null);
          const destination = validateSemanticDestination(item.destination || (resource.destinationId ? {
            destinationId: resource.destinationId,
            state: item.destinationState || {},
            target: { reference: item.reference, ...(inferredTargetKind ? { kind: inferredTargetKind } : {}) },
          } : null), currentManifest);
          if (resource.materialization?.nestedDestination === "exact-reveal-required") {
            const declaration = findCapability(currentManifest.navigationDestinations, destination?.destinationId, "navigation");
            assertNestedRevealIntent(destination, declaration);
          }
          return {
            reference: item.reference,
            label: String(item.label || "").slice(0, 240),
            fields: item.fields && typeof item.fields === "object" ? item.fields : {},
            destination,
          };
        }) : [];
        return {
          resourceId: resource.id,
          data: raw,
          items,
          mode,
          total: Number.isFinite(raw?.total) ? raw.total : items.length,
          summary: String(raw?.summary || "").slice(0, 1000),
          status: raw?.status === "partial" ? "partial" : "succeeded",
          nextCursor: pagination.style === "cursor" && typeof raw?.nextCursor === "string" ? raw.nextCursor : null,
          asOf: typeof raw?.asOf === "string" ? raw.asOf : null,
        };
      });
    },
    async queryBatch(request = {}) {
      const requests = Array.isArray(request.requests) ? request.requests : [];
      if (!requests.length) throw new TypeError("query-batch-requests-required");
      if (requests.length > 20) throw new TypeError("query-batch-too-large");
      const concurrency = Math.min(Math.max(Number(request.concurrency || 4), 1), 8);
      const results = new Array(requests.length);
      let cursor = 0;
      let firstFailure = null;
      const worker = async () => {
        while (cursor < requests.length && !(request.failFast && firstFailure)) {
          const index = cursor;
          cursor += 1;
          const child = requests[index] || {};
          try {
            results[index] = Object.freeze({
              resourceId: String(child.resourceId || ""),
              status: "succeeded",
              result: await api.query(child),
            });
          } catch (error) {
            const problem = toSiteAgentProblem(error, { correlationId: child.correlationId });
            results[index] = Object.freeze({
              resourceId: String(child.resourceId || ""),
              status: "failed",
              problem,
            });
            firstFailure ||= problem;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, worker));
      if (request.failFast && firstFailure) throw firstFailure;
      return Object.freeze({
        status: results.some(({ status }) => status === "failed") ? "partial" : "succeeded",
        results: Object.freeze(results.filter(Boolean)),
      });
    },
    async subscribe(request = {}, listener) {
      return invoke("query", request.resourceId, request, async (execution) => {
        const currentManifest = await getManifest();
        if (typeof listener !== "function") throw new TypeError("query-subscription-listener-required");
        const context = await getContext();
        const resource = findCapability(currentManifest.queryResources, request.resourceId, "query");
        assertAuthorized(resource, context);
        if (resource.freshness?.mode !== "live") throw new Error("query-subscription-not-supported");
        const subscribe = requiredAdapter(adapters.query?.subscribe, "query-subscribe");
        const allowedEvents = new Map((currentManifest.events || [])
          .filter((event) => (resource.freshness?.eventIds || []).includes(event.id))
          .map((event) => [event.id, event]));
        const guardedListener = (event) => {
          const definition = allowedEvents.get(event?.eventId);
          if (!definition) throw new Error("query-subscription-event-not-declared");
          assertSchemaValue(definition.payloadSchema, event.payload, "query-subscription-event");
          listener(event);
        };
        execution.assertActive();
        const result = await subscribe({ context, execution, request, resource, listener: guardedListener });
        const unsubscribe = typeof result === "function" ? result : result?.unsubscribe;
        if (typeof unsubscribe !== "function") throw new Error("query-subscription-invalid");
        return Object.freeze({ unsubscribe });
      });
    },
    async navigate(intent = {}) {
      return invoke("navigation", intent.destinationId, intent, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const destination = findCapability(currentManifest.navigationDestinations, intent.destinationId, "navigation");
        assertAuthorized(destination, context);
        validateSemanticDestination(intent, currentManifest);
        assertNestedRevealIntent(intent, destination);
        if (destination.stateSchema) assertSchemaValue(destination.stateSchema, intent.state || {}, "navigation-state");
        const adapter = adapters.navigation;
        execution.assertActive();
        let outcome;
        if (destination.reveal?.mode === "nested" && adapter && typeof adapter !== "function"
          && typeof adapter.navigate !== "function") {
          outcome = await runNavigationReveal({ adapter, context, destination, execution, intent });
        } else {
          const navigate = requiredAdapter(adapter?.navigate || adapter, "navigation");
          outcome = await navigate({ context, destination, execution, intent });
        }
        if (!outcome || outcome.exact !== true || outcome.visible !== true) throw new Error("navigation-target-not-verified");
        assertNestedRevealOutcome(outcome, intent, destination);
        return outcome;
      });
    },
    async prepareAction(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        assertSchemaValue(action.inputSchema, request.input || {}, "action-input");
        const adapter = requiredAdapter(adapters.action?.prepare, "action-prepare");
        execution.assertActive();
        const plan = await adapter({ action, context, execution, request });
        if (!plan?.planId || plan.status !== "prepared" || !plan.expiresAt) throw new Error("invalid-action-plan");
        if (!Number.isFinite(Date.parse(plan.expiresAt))) throw new Error("invalid-action-plan-expiry");
        if (action.confirmation !== "none" && plan.confirmation !== action.confirmation) throw new Error("invalid-action-confirmation");
        preparedPlans.set(plan.planId, { actionId: action.id, expiresAt: plan.expiresAt });
        return { ...plan, actionId: action.id, destination: validateSemanticDestination(plan.destination, currentManifest) };
      });
    },
    async confirmAction(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        if (consumedPlans.has(request.planId)) throw new Error("action-plan-already-consumed");
        const prepared = preparedPlans.get(request.planId);
        if (!prepared || prepared.actionId !== request.actionId) throw new Error("action-plan-not-prepared");
        if (Date.parse(prepared.expiresAt) <= now()) throw new Error("action-plan-expired");
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        if (action.confirmationSchema) {
          assertSchemaValue(action.confirmationSchema, request.confirmation, "action-confirmation");
        }
        const adapter = requiredAdapter(adapters.action?.confirm, "action-confirm");
        execution.assertActive();
        const result = await adapter({ action, context, execution, request });
        const acceptedStatuses = new Set(["confirmed", "already-applied", "reconfirmation-required", "working"]);
        if (!result || !acceptedStatuses.has(result.status)) throw new Error("action-confirmation-failed");
        let normalizedResult = result;
        if (result.status === "working") {
          if (action.taskSupport === "forbidden" || !result.task?.taskId) throw new Error("action-task-not-supported");
          normalizedResult = { ...result, task: normalizeActionTask(result.task, action) };
          consumedPlans.add(request.planId);
        }
        if (result.status === "reconfirmation-required") {
          if (!result.replacementPlan?.planId || result.replacementPlan.status !== "prepared") {
            throw new Error("invalid-reconciliation-plan");
          }
          if (!Number.isFinite(Date.parse(result.replacementPlan.expiresAt))) throw new Error("invalid-reconciliation-plan-expiry");
          consumedPlans.add(request.planId);
          preparedPlans.set(result.replacementPlan.planId, {
            actionId: action.id,
            expiresAt: result.replacementPlan.expiresAt,
          });
        } else if (result.status !== "working") {
          consumedPlans.add(request.planId);
        }
        if (["confirmed", "already-applied"].includes(result.status) && action.outputSchema) {
          assertSchemaValue(action.outputSchema, result.output || {}, "action-output");
        }
        return {
          ...normalizedResult,
          destination: validateSemanticDestination(result.destination, currentManifest),
          replacementPlan: result.replacementPlan
            ? { ...result.replacementPlan, destination: validateSemanticDestination(result.replacementPlan.destination, currentManifest) }
            : undefined,
        };
      });
    },
    async cancelAction(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        if (consumedPlans.has(request.planId)) throw new Error("action-plan-already-consumed");
        const prepared = preparedPlans.get(request.planId);
        if (!prepared || prepared.actionId !== request.actionId) throw new Error("action-plan-not-prepared");
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        const adapter = requiredAdapter(adapters.action?.cancel, "action-cancel");
        execution.assertActive();
        const result = await adapter({ action, context, execution, request });
        if (!result || result.status !== "canceled") throw new Error("action-cancel-failed");
        consumedPlans.add(request.planId);
        return result;
      });
    },
    async getTask(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        if (action.taskSupport === "forbidden") throw new Error("action-task-not-supported");
        const getTask = requiredAdapter(adapters.action?.getTask, "action-task-get");
        execution.assertActive();
        const task = await getTask({ action, context, execution, request });
        return normalizeActionTask(task, action);
      });
    },
    async updateTask(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        if (action.taskSupport === "forbidden") throw new Error("action-task-not-supported");
        if (!request.inputResponses || typeof request.inputResponses !== "object" || Array.isArray(request.inputResponses)) {
          throw new Error("action-task-input-responses-required");
        }
        const updateTask = requiredAdapter(adapters.action?.updateTask, "action-task-update");
        execution.assertActive();
        const result = await updateTask({ action, context, execution, request });
        if (!result || result.acknowledged !== true) throw new Error("action-task-update-failed");
        return Object.freeze({ acknowledged: true });
      });
    },
    async cancelTask(request = {}) {
      return invoke("action", request.actionId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const action = findCapability(currentManifest.actions, request.actionId, "action");
        assertAuthorized(action, context);
        if (action.taskSupport === "forbidden") throw new Error("action-task-not-supported");
        const cancelTask = requiredAdapter(adapters.action?.cancelTask, "action-task-cancel");
        execution.assertActive();
        const result = await cancelTask({ action, context, execution, request });
        if (result?.acknowledged === true) return Object.freeze({ acknowledged: true });
        if (result?.taskId) {
          return Object.freeze({ acknowledged: true, task: normalizeActionTask(result, action) });
        }
        throw new Error("action-task-cancel-failed");
      });
    },
  };
  return Object.freeze(api);
}
