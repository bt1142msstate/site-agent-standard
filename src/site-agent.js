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
export * from "./query-quality.js";

function now() {
  return Date.now();
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function searchTokens(value) {
  return [...new Set(normalizeSearchText(value).split(/\s+/).filter((token) => token.length > 1))];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
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
    selectableFields: Object.freeze([...(resource.selectableFields || [])]),
    freshness: resource.freshness ? Object.freeze({ ...resource.freshness }) : null,
    batching: resource.batching ? Object.freeze({ ...resource.batching }) : null,
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

  function prepareQuery(currentManifest, context, request = {}) {
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
    const pagination = resource.pagination || {
      style: "none",
      defaultLimit: resource.maxResults || 25,
      maxLimit: resource.maxResults || 100,
    };
    if (request.cursor && pagination.style !== "cursor") throw new Error("query-cursor-not-supported");
    const maximum = Number(pagination.maxLimit || resource.maxResults || 100);
    const limit = Math.min(Math.max(Number(request.limit || pagination.defaultLimit || resource.maxResults || 25), 1), maximum);
    const select = request.select === undefined ? [...(resource.defaultFields || [])] : [...new Set(request.select || [])];
    if (request.select !== undefined && !resource.selectableFields) throw new Error("query-field-selection-not-supported");
    for (const field of select) {
      if (!(resource.selectableFields || []).includes(field)) throw new Error(`query-field-not-selectable:${field}`);
    }
    const normalizedRequest = { ...request, filters, limit, mode, ...(select.length ? { select } : {}) };
    const fingerprint = stableJson({
      resourceId: resource.id,
      mode,
      filters,
      sort: request.sort || null,
      limit,
      cursor: request.cursor || null,
      select,
    });
    const baseFingerprint = stableJson({
      resourceId: resource.id,
      filters,
      sort: request.sort || null,
      limit,
      cursor: request.cursor || null,
      select,
    });
    return { resource, pagination, request: normalizedRequest, fingerprint, baseFingerprint };
  }

  function normalizeEvidence(resource, raw, nextCursor, asOf) {
    const explicit = raw?.evidence && typeof raw.evidence === "object" ? raw.evidence : {};
    const reasons = [...new Set([
      ...(Array.isArray(explicit.reasons) ? explicit.reasons : []),
      ...(raw?.status === "partial" ? ["source-reported-partial"] : []),
      ...(raw?.truncated === true || nextCursor ? ["more-results-available"] : []),
    ].map((value) => String(value || "").trim()).filter(Boolean))];
    let completeness = explicit.completeness;
    if (!new Set(["complete", "partial", "unknown"]).has(completeness)) {
      if (raw?.complete === true && !reasons.length) completeness = "complete";
      else if (raw?.complete === false || reasons.length) completeness = "partial";
      else completeness = "unknown";
    }
    const declaredSources = Array.isArray(explicit.provenance)
      ? explicit.provenance
      : Array.isArray(explicit.sources) ? explicit.sources : [];
    const provenance = declaredSources.length ? declaredSources.map((source) => ({
      resourceId: String(source.resourceId || resource.id),
      asOf: typeof source.asOf === "string" ? source.asOf : asOf,
      revision: typeof source.revision === "string" ? source.revision : null,
      ...(source.source ? { source: String(source.source).slice(0, 160) } : {}),
    })) : [{
      resourceId: resource.id,
      asOf,
      revision: typeof raw?.revision === "string" ? raw.revision : null,
    }];
    return Object.freeze({
      completeness,
      reasons: Object.freeze(reasons),
      provenance: Object.freeze(provenance.map(Object.freeze)),
    });
  }

  function normalizeQueryResult(currentManifest, prepared, raw) {
    const { resource, pagination, request } = prepared;
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
    const nextCursor = pagination.style === "cursor" && typeof raw?.nextCursor === "string" ? raw.nextCursor : null;
    const asOf = typeof raw?.asOf === "string" ? raw.asOf : null;
    const evidence = normalizeEvidence(resource, raw, nextCursor, asOf);
    return Object.freeze({
      resourceId: resource.id,
      data: raw,
      items: Object.freeze(items),
      mode: request.mode,
      total: Number.isFinite(raw?.total) ? raw.total : items.length,
      summary: String(raw?.summary || "").slice(0, 1000),
      status: evidence.completeness === "partial" || raw?.status === "partial" ? "partial" : "succeeded",
      nextCursor,
      asOf,
      evidence,
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
        const rankAll = (searchText) => filtered.queryResources
          .filter(({ status }) => status !== "sunset")
          .filter((resource) => !request.execution || resource.execution === request.execution)
          .filter((resource) => !request.mode || resource.modes.includes(request.mode))
          .map((resource) => ({ resource, score: queryResourceScore(resource, searchText) }))
          .filter(({ score }) => !searchText.trim() || score > 0)
          .sort((left, right) => right.score - left.score
            || left.resource.id.localeCompare(right.resource.id));
        const rank = (searchText) => rankAll(searchText)
          .slice(0, maximum)
          .map(({ resource, score }) => describeQueryResource(resource, score));
        const resources = rank(text);
        const needs = (Array.isArray(request.needs) ? request.needs : []).slice(0, 20).map((need, index) => ({
          key: String(need?.key || `need-${index + 1}`).slice(0, 80),
          text: String(need?.text || "").slice(0, 500),
        }));
        if (new Set(needs.map(({ key }) => key)).size !== needs.length) {
          throw new TypeError("query-discovery-keys-must-be-unique");
        }
        return Object.freeze({
          text,
          total: rankAll(text).length,
          resources: Object.freeze(resources),
          ...(needs.length ? {
            needs: Object.freeze(needs.map((need) => Object.freeze({
              ...need,
              resources: Object.freeze(rank(need.text)),
            }))),
          } : {}),
        });
      });
    },
    async query(request = {}) {
      return invoke("query", request.resourceId, request, async (execution) => {
        const currentManifest = await getManifest();
        const context = await getContext();
        const prepared = prepareQuery(currentManifest, context, request);
        const adapter = requiredAdapter(adapters.query?.execute || adapters.query, "query");
        execution.assertActive();
        const raw = await adapter({ context, execution, request: prepared.request, resource: prepared.resource });
        return normalizeQueryResult(currentManifest, prepared, raw);
      });
    },
    async queryBatch(request = {}) {
      const startedAt = now();
      const requests = Array.isArray(request.requests) ? request.requests : [];
      if (!requests.length) throw new TypeError("query-batch-requests-required");
      if (requests.length > 20) throw new TypeError("query-batch-too-large");
      const keys = requests.map((child, index) => String(child?.key || `request-${index + 1}`).slice(0, 80));
      if (new Set(keys).size !== keys.length) throw new TypeError("query-batch-keys-must-be-unique");
      const concurrency = Math.min(Math.max(Number(request.concurrency || 4), 1), 8);
      const results = new Array(requests.length);
      const currentManifest = await getManifest();
      const context = await getContext();
      const preparedEntries = [];
      let firstFailure;
      for (let index = 0; index < requests.length; index += 1) {
        const child = requests[index] || {};
        try {
          preparedEntries.push({ index, key: keys[index], prepared: prepareQuery(currentManifest, context, child) });
        } catch (error) {
          const problem = toSiteAgentProblem(error, { correlationId: child.correlationId });
          results[index] = Object.freeze({ key: keys[index], resourceId: String(child.resourceId || ""), status: "failed", problem });
          firstFailure ||= problem;
        }
      }
      if (request.failFast && firstFailure) throw firstFailure;
      if (request.consistency === "snapshot") {
        const groups = new Set(preparedEntries.map(({ prepared }) => prepared.resource.batching?.group));
        if (groups.has(undefined) || groups.size !== 1
          || preparedEntries.some(({ prepared }) => prepared.resource.batching?.consistency !== "snapshot")) {
          throw new TypeError("query-batch-snapshot-consistency-not-supported");
        }
      }

      const executions = [];
      const executionByEntry = new Map();
      const groups = new Map();
      for (const entry of preparedEntries) {
        const values = groups.get(entry.prepared.baseFingerprint) || [];
        values.push(entry);
        groups.set(entry.prepared.baseFingerprint, values);
      }
      for (const entries of groups.values()) {
        const covering = entries.find(({ prepared }) => {
          const covers = new Set([
            prepared.request.mode,
            ...(prepared.resource.modeCoverage || []).find(({ mode }) => mode === prepared.request.mode)?.covers || [],
          ]);
          return entries.every((entry) => covers.has(entry.prepared.request.mode));
        });
        if (covering) {
          const execution = { ...covering, executionKey: `execution-${executions.length + 1}` };
          executions.push(execution);
          entries.forEach((entry) => executionByEntry.set(entry, execution));
          continue;
        }
        const byFingerprint = new Map();
        for (const entry of entries) {
          let execution = byFingerprint.get(entry.prepared.fingerprint);
          if (!execution) {
            execution = { ...entry, executionKey: `execution-${executions.length + 1}` };
            executions.push(execution);
            byFingerprint.set(entry.prepared.fingerprint, execution);
          }
          executionByEntry.set(entry, execution);
        }
      }

      const rawByExecution = new Map();
      const problemByExecution = new Map();
      let transportCalls = 0;
      const batchAdapter = adapters.query?.executeBatch;
      if (executions.length && typeof batchAdapter === "function") {
        const declaredMax = executions.reduce((maximum, entry) => (
          Math.min(maximum, Number(entry.prepared.resource.batching?.maxSize || 20))
        ), 20);
        for (let offset = 0; offset < executions.length; offset += declaredMax) {
          const chunk = executions.slice(offset, offset + declaredMax);
          transportCalls += 1;
          const execution = createExecutionContext(request);
          execution.assertActive();
          const batchResult = await batchAdapter({
            context,
            execution,
            consistency: request.consistency || "independent",
            requests: chunk.map((entry) => ({
              key: entry.executionKey,
              request: entry.prepared.request,
              resource: entry.prepared.resource,
            })),
          });
          const returned = Array.isArray(batchResult) ? batchResult : batchResult?.results;
          if (!Array.isArray(returned)) throw new Error("query-batch-adapter-result-invalid");
          const byKey = new Map(returned.map((entry, index) => [String(entry?.key || chunk[index]?.executionKey || ""), entry]));
          for (const entry of chunk) {
            const returnedEntry = byKey.get(entry.executionKey);
            if (!returnedEntry) {
              problemByExecution.set(entry.executionKey, toSiteAgentProblem(new Error("query-batch-adapter-result-missing")));
            } else if (returnedEntry.status === "failed" || returnedEntry.problem) {
              problemByExecution.set(entry.executionKey, toSiteAgentProblem(returnedEntry.problem || new Error("query-batch-adapter-failed")));
            } else {
              rawByExecution.set(entry.executionKey, returnedEntry.result ?? returnedEntry.data ?? returnedEntry);
            }
          }
        }
      } else {
        const adapter = requiredAdapter(adapters.query?.execute || adapters.query, "query");
        let cursor = 0;
        transportCalls = executions.length;
        const worker = async () => {
          while (cursor < executions.length && !(request.failFast && firstFailure)) {
            const entry = executions[cursor];
            cursor += 1;
            try {
              const execution = createExecutionContext(entry.prepared.request);
              execution.assertActive();
              rawByExecution.set(entry.executionKey, await adapter({
                context,
                execution,
                request: entry.prepared.request,
                resource: entry.prepared.resource,
              }));
            } catch (error) {
              const problem = toSiteAgentProblem(error, { correlationId: entry.prepared.request.correlationId });
              problemByExecution.set(entry.executionKey, problem);
              firstFailure ||= problem;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, executions.length) }, worker));
      }

      for (const entry of preparedEntries) {
        const execution = executionByEntry.get(entry);
        const problem = problemByExecution.get(execution.executionKey);
        if (problem) {
          results[entry.index] = Object.freeze({ key: entry.key, resourceId: entry.prepared.resource.id, status: "failed", problem });
          firstFailure ||= problem;
          continue;
        }
        try {
          results[entry.index] = Object.freeze({
            key: entry.key,
            resourceId: entry.prepared.resource.id,
            status: "succeeded",
            result: normalizeQueryResult(currentManifest, entry.prepared, rawByExecution.get(execution.executionKey)),
          });
        } catch (error) {
          const normalized = toSiteAgentProblem(error, { correlationId: entry.prepared.request.correlationId });
          results[entry.index] = Object.freeze({ key: entry.key, resourceId: entry.prepared.resource.id, status: "failed", problem: normalized });
          firstFailure ||= normalized;
        }
      }
      if (request.failFast && firstFailure) throw firstFailure;
      return Object.freeze({
        status: results.some(({ status }) => status === "failed") ? "partial" : "succeeded",
        results: Object.freeze(results.filter(Boolean)),
        metrics: Object.freeze({
          requested: requests.length,
          executed: executions.length,
          deduplicated: preparedEntries.length - executions.length,
          transportCalls,
          durationMs: now() - startedAt,
        }),
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
