import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createArazzoBinding,
  createAsyncApiBinding,
  createMcpBinding,
  createSiteAgent,
  evaluateQueryQuality,
  negotiateSiteAgentVersion,
  registerWebMcpTools,
  runNavigationReveal,
  runSiteAgentConformance,
  SiteAgentProblem,
  stableFingerprintPayload,
  validateRenderedQualityEvidence,
  validateSiteAgentManifest,
  validateTutorialArtifactAcceptanceEvidence,
  validateCoverageEvidence,
} from "../../src/site-agent.js";
import createConformanceTarget from "../../examples/basic/conformance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const example = () => JSON.parse(fs.readFileSync(path.join(root, "examples/basic/site-agent.json"), "utf8"));

test("0.2 validates declared schemas and lifecycle metadata", () => {
  const manifest = example();
  assert.deepEqual(validateSiteAgentManifest(manifest), { valid: true, errors: [] });
  manifest.queryResources[0].filters.status = { type: "not-a-json-schema-type" };
  assert.equal(validateSiteAgentManifest(manifest).valid, false);
  assert.equal(negotiateSiteAgentVersion(["0.1", "0.2"]), "0.2");
  assert.equal(negotiateSiteAgentVersion(["9.0"]), null);
});

test("presentation requires computed-style quality coverage and valid multi-actor context ownership", () => {
  const manifest = example();
  assert.equal(validateSiteAgentManifest(manifest).valid, true);

  const missingQuality = example();
  delete missingQuality.presentation.visualQuality;
  assert.match(validateSiteAgentManifest(missingQuality).errors.join("\n"), /visualQuality is required/);

  const mismatchedActor = example();
  mismatchedActor.workflows[0].steps[0].actorId = "operator";
  assert.match(validateSiteAgentManifest(mismatchedActor).errors.join("\n"), /does not own contextId client/);
});

test("stable fingerprints ignore generator timestamps but retain meaningful content", () => {
  const first = stableFingerprintPayload([{ path: "generated.json", value: {
    generatedAt: "2026-08-01T00:00:00.000Z",
    controls: [{ id: "save", label: "Save" }],
  } }]);
  const timestampOnly = stableFingerprintPayload([{ path: "generated.json", value: {
    generatedAt: "2026-08-06T00:00:00.000Z",
    controls: [{ id: "save", label: "Save" }],
  } }]);
  const changed = stableFingerprintPayload([{ path: "generated.json", value: {
    generatedAt: "2026-08-06T00:00:00.000Z",
    controls: [{ id: "save", label: "Publish" }],
  } }]);
  assert.equal(first, timestampOnly);
  assert.notEqual(first, changed);
});

test("rendered-quality and tutorial artifact evidence reject incomplete matrices and media", () => {
  const manifest = example();
  const matrix = manifest.workflows[0].steps.flatMap((step) => (
    manifest.presentation.responsiveVariants.flatMap((viewport) => (
      manifest.presentation.supportedThemes.map((theme) => ({
        mappedStateId: `${manifest.workflows[0].id}:${step.id}`,
        viewport,
        theme,
        computedStyles: true,
        labelsChecked: 1,
        textContrastChecks: 1,
        violations: [],
      }))
    ))
  ));
  assert.equal(validateRenderedQualityEvidence(manifest, {
    source: "browser-computed-style",
    observations: matrix,
  }).valid, true);
  assert.equal(validateRenderedQualityEvidence(manifest, {
    source: "browser-computed-style",
    observations: matrix.slice(1),
  }).valid, false);

  const evidence = {
    timelineDurationMs: 4000,
    sourceFingerprint: { algorithm: "sha256", normalization: "stable-content-v1", digest: "a".repeat(64) },
    media: {
      video: { decodedFullDuration: true, durationMs: 4000 },
      audio: { required: true, present: true, decodedFullDuration: true, durationMs: 4000 },
    },
    integrity: { verified: true },
    deployment: { isolated: true, cleanBeforeWrite: true, symlinkFree: true, pathClass: "generated-artifact" },
  };
  assert.equal(validateTutorialArtifactAcceptanceEvidence(evidence).valid, true);
  assert.match(
    validateTutorialArtifactAcceptanceEvidence({
      ...evidence,
      media: { ...evidence.media, audio: { ...evidence.media.audio, decodedFullDuration: false } },
    }).errors.join("\n"),
    /audio-full-decode-required/,
  );
});

test("local static Query resources require materialized user-surface provenance", () => {
  const manifest = example();
  manifest.queryResources.push({
    id: "public-copy",
    description: "Materialized public page copy",
    visibility: "public",
    execution: "local",
    modes: ["records"],
    filters: { query: { type: "string" } },
    resultSchema: { type: "object" },
    pagination: { style: "none" },
    freshness: { mode: "static" },
  });
  assert.match(validateSiteAgentManifest(manifest).errors.join("\n"), /materialization is required/);
  manifest.queryResources.at(-1).materialization = {
    basis: "rendered-user-surface",
    stage: "build",
    surfaceParity: "required",
    nestedContent: "resolved",
    nestedDestination: "not-applicable",
  };
  assert.equal(validateSiteAgentManifest(manifest).valid, true);
});

function nestedDocumentManifest() {
  const manifest = example();
  manifest.queryResources.push({
    id: "public-document-text",
    description: "Materialized excerpts from a linked public document",
    visibility: "public",
    execution: "local",
    modes: ["records"],
    filters: { query: { type: "string" } },
    resultSchema: { type: "object" },
    pagination: { style: "none" },
    freshness: { mode: "static" },
    materialization: {
      basis: "document-text",
      stage: "build",
      surfaceParity: "required",
      nestedContent: "resolved",
      nestedDestination: "exact-reveal-required",
    },
    destinationId: "public-document.excerpt",
    resultTargetKind: "document-segment",
  });
  manifest.navigationDestinations.push({
    id: "public-document.excerpt",
    description: "Open a linked document and reveal its exact source excerpt",
    visibility: "public",
    route: "/resources/documents/example/",
    precision: "record-page",
    exact: true,
    targetKinds: ["document-segment"],
    stateSchema: {
      type: "object",
      required: ["documentPage"],
      properties: { documentPage: { type: "integer", minimum: 1 } },
      additionalProperties: false,
    },
    reveal: {
      mode: "nested",
      steps: [
        { id: "resource-route", kind: "route" },
        { id: "document-page", kind: "state", stateKeys: ["documentPage"] },
        { id: "document-content", kind: "nested-resource", targetKinds: ["document-text"] },
        { id: "source-excerpt", kind: "target", targetKinds: ["document-segment"] },
      ],
      verification: "each-step-and-final-target",
      outerSurfaceFallback: false,
    },
  });
  return manifest;
}

test("nested document results require a complete exact reveal contract", async () => {
  const manifest = nestedDocumentManifest();
  assert.deepEqual(validateSiteAgentManifest(manifest), { valid: true, errors: [] });

  const withoutReveal = nestedDocumentManifest();
  delete withoutReveal.navigationDestinations.at(-1).reveal;
  assert.match(validateSiteAgentManifest(withoutReveal).errors.join("\n"), /requires a nested reveal contract/);

  const createNestedAgent = (destination, navigation) => createSiteAgent({
    manifest,
    context: { authenticated: false, permissions: [] },
    adapters: {
      query: async () => ({
        items: [{ reference: "opaque-excerpt-1", label: "Tuition", fields: {}, destination }],
        total: 1,
      }),
      navigation,
    },
  });
  const exactDestination = {
    destinationId: "public-document.excerpt",
    state: { documentPage: 11 },
    target: { reference: "opaque-excerpt-1", kind: "document-segment" },
  };

  const broadAgent = createNestedAgent({
    ...exactDestination,
    target: { reference: "opaque-document-1", kind: "document" },
  }, async () => ({ exact: true, visible: true }));
  await assert.rejects(broadAgent.query({ resourceId: "public-document-text" }), /target-kind-invalid/);

  const unverifiedAgent = createNestedAgent(exactDestination, async () => ({ exact: true, visible: true }));
  const result = await unverifiedAgent.query({ resourceId: "public-document-text" });
  await assert.rejects(unverifiedAgent.navigate(result.items[0].destination), /reveal-not-complete/);

  const verifiedAgent = createNestedAgent(exactDestination, async () => ({
    exact: true,
    visible: true,
    targetKind: "document-segment",
    reveal: {
      complete: true,
      verifiedSteps: ["resource-route", "document-page", "document-content", "source-excerpt"],
    },
  }));
  const verifiedQuery = await verifiedAgent.query({ resourceId: "public-document-text" });
  assert.equal(verifiedQuery.items[0].destination.target.kind, "document-segment");
  assert.equal((await verifiedAgent.navigate(verifiedQuery.items[0].destination)).visible, true);
});

test("multi-kind destinations accept an allowed exact kind on each query result", async () => {
  const manifest = nestedDocumentManifest();
  const resource = manifest.queryResources.at(-1);
  const destination = manifest.navigationDestinations.at(-1);
  delete resource.resultTargetKind;
  destination.targetKinds.push("document-image");
  assert.deepEqual(validateSiteAgentManifest(manifest), { valid: true, errors: [] });
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: false, permissions: [] },
    adapters: {
      query: async () => ({
        total: 1,
        items: [{
          reference: "opaque-image-1",
          label: "Badge photo",
          fields: {},
          destination: {
            destinationId: destination.id,
            state: { documentPage: 1 },
            target: { reference: "opaque-image-1", kind: "document-image" },
          },
        }],
      }),
    },
  });
  const result = await agent.query({ resourceId: resource.id });
  assert.equal(result.items[0].destination.target.kind, "document-image");
});

test("0.2 rejects broken event, relationship, replacement, and workflow references", () => {
  const manifest = example();
  manifest.queryResources[0].freshness.eventIds = ["missing.event"];
  manifest.queryResources[0].relationships = ["missing.resource"];
  manifest.actions[0].status = "deprecated";
  manifest.actions[0].replacedBy = "missing.action";
  manifest.workflows[0].steps[1].dependsOn = ["missing-step"];
  const result = validateSiteAgentManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unknown event/);
  assert.match(result.errors.join("\n"), /unknown query resource/);
  assert.match(result.errors.join("\n"), /unknown capability/);
  assert.match(result.errors.join("\n"), /unknown step/);
});

test("0.2 validates query input/output, cursor pagination, and live subscriptions", async () => {
  const manifest = example();
  manifest.queryResources[0].freshness = { mode: "live", eventIds: ["orders.changed"] };
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: {
      query: {
        execute: async () => ({ items: [], total: 0, nextCursor: "opaque-next", asOf: "2026-08-04T00:00:00.000Z" }),
        subscribe: async ({ listener }) => {
          listener({ eventId: "orders.changed", payload: { reference: "opaque-order-1" } });
          return () => {};
        },
      },
    },
  });
  const result = await agent.query({ resourceId: "orders", cursor: "opaque-current", filters: { status: "open" } });
  assert.equal(result.nextCursor, "opaque-next");
  assert.equal((await agent.subscribe({ resourceId: "orders" }, () => {})).unsubscribe instanceof Function, true);
  await assert.rejects(agent.query({ resourceId: "orders", filters: { status: 7 } }), /query-filters-schema-invalid/);
});

test("large query catalogs are permission-filtered, discoverable, batchable, and WebMCP-brokered", async () => {
  const manifest = example();
  manifest.queryResources[0].aliases = ["customer purchases"];
  manifest.queryResources[0].keywords = ["fulfillment", "status"];
  manifest.queryResources[0].examples = ["Which orders are still open?"];
  for (let index = 0; index < 25; index += 1) {
    manifest.queryResources.push({
      ...structuredClone(manifest.queryResources[0]),
      id: `private-source-${index}`,
      title: `Private source ${index}`,
      description: `Authorized information source number ${index}`,
      permissionsAll: ["orders.view"],
    });
  }
  manifest.queryResources.push({
    ...structuredClone(manifest.queryResources[0]),
    id: "secret-source",
    title: "Secret source",
    description: "Restricted information that must not be discoverable",
    permissionsAll: ["private.view"],
  });
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: { query: async () => ({ items: [], total: 0, summary: "No matching orders" }) },
  });
  const discovery = await agent.findQueryResources({ text: "customer purchase status" });
  assert.equal(discovery.resources[0].resourceId, "orders");
  assert.equal(discovery.resources.some(({ resourceId }) => resourceId === "secret-source"), false);

  const batch = await agent.queryBatch({
    requests: [{ resourceId: "orders" }, { resourceId: "missing" }],
  });
  assert.equal(batch.status, "partial");
  assert.deepEqual(batch.results.map(({ status }) => status), ["succeeded", "failed"]);

  const registered = [];
  const handle = await registerWebMcpTools({
    document: { modelContext: { registerTool: async (tool) => registered.push(tool) } },
    agent,
  });
  assert.ok(handle.registeredToolNames.includes("site.find_queries"));
  assert.ok(handle.registeredToolNames.includes("site.query"));
  assert.equal(handle.registeredToolNames.some((name) => name === "query.secret-source"), false);
  const found = await registered.find(({ name }) => name === "site.find_queries").execute({ text: "orders" });
  assert.equal(found.resources[0].resourceId, "orders");
  handle.unregister();
});

test("query batches collapse declared mode coverage into one host transport and preserve evidence", async () => {
  const manifest = example();
  const resource = manifest.queryResources[0];
  resource.aliases = ["customer purchases", "order count"];
  resource.modeCoverage = [{ mode: "records", covers: ["count"] }];
  resource.selectableFields = ["label", "status"];
  resource.defaultFields = ["label"];
  resource.batching = { group: "orders", maxSize: 20, consistency: "snapshot" };
  assert.deepEqual(validateSiteAgentManifest(manifest), { valid: true, errors: [] });
  let transports = 0;
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: {
      query: {
        execute: async () => { throw new Error("single transport must not run"); },
        executeBatch: async ({ requests }) => {
          transports += 1;
          assert.equal(requests.length, 1);
          assert.equal(requests[0].request.mode, "records");
          return { results: requests.map(({ key }) => ({
            key,
            result: {
              items: [{ reference: "opaque-order-1", label: "Order 1", fields: { status: "open" } }],
              total: 1,
              complete: true,
              asOf: "2026-08-29T06:00:00.000Z",
              revision: "orders-42",
            },
          })) };
        },
      },
    },
  });
  const result = await agent.queryBatch({
    consistency: "snapshot",
    requests: [
      { key: "records", resourceId: "orders", mode: "records", filters: { status: "open" } },
      { key: "count", resourceId: "orders", mode: "count", filters: { status: "open" } },
      { key: "count-again", resourceId: "orders", mode: "count", filters: { status: "open" } },
    ],
  });
  assert.equal(transports, 1);
  assert.deepEqual(result.metrics, {
    requested: 3,
    executed: 1,
    deduplicated: 2,
    transportCalls: 1,
    durationMs: result.metrics.durationMs,
  });
  assert.deepEqual(result.results.map(({ key }) => key), ["records", "count", "count-again"]);
  assert.ok(result.results.every(({ result: item }) => item.evidence.completeness === "complete"));
  assert.equal(result.results[1].result.mode, "count");
  assert.equal(result.results[0].result.evidence.provenance[0].revision, "orders-42");

  const discovery = await agent.findQueryResources({
    needs: [{ key: "open", text: "open customer purchases" }, { key: "totals", text: "order count" }],
  });
  assert.deepEqual(discovery.needs.map(({ key }) => key), ["open", "totals"]);
  assert.equal(discovery.needs[0].resources[0].resourceId, "orders");
});

test("query quality gates answer accuracy, evidence coverage, disclosure, and request cost", () => {
  const passing = evaluateQueryQuality({ cases: [{
    id: "mixed-live-static",
    answerCorrect: true,
    expectedFacts: ["privacy.analytics", "open-shifts.count"],
    supportedFacts: ["privacy.analytics", "open-shifts.count"],
    requiredSources: ["static-site-content", "open-shifts"],
    returnedSources: ["static-site-content", "open-shifts"],
    completeness: "complete",
    toolCalls: 1,
    transportCalls: 1,
    internalRequests: 2,
    deduplicatedRequests: 0,
    durationMs: 900,
  }] });
  assert.equal(passing.readiness, "ready");
  assert.equal(passing.cases.accuracyPercent, 100);

  const failing = evaluateQueryQuality({ cases: [{
    id: "silent-partial",
    answerCorrect: false,
    expectedFacts: ["one", "two"],
    supportedFacts: ["one"],
    requiredSources: ["a", "b"],
    returnedSources: ["a"],
    completeness: "partial",
    partialDisclosed: false,
    toolCalls: 2,
    transportCalls: 2,
    internalRequests: 2,
    deduplicatedRequests: 0,
    durationMs: 13_000,
  }] });
  assert.equal(failing.readiness, "not-ready");
  assert.match(failing.errors.join("\n"), /answer-incorrect/);
  assert.match(failing.errors.join("\n"), /partial-not-disclosed/);
  assert.match(failing.errors.join("\n"), /transport-call-budget-exceeded/);
});

test("nested reveal orchestration verifies every semantic layer in order and waits for virtualization", async () => {
  const destination = {
    targetKinds: ["document-segment"],
    reveal: {
      mode: "nested",
      steps: [
        { id: "route", kind: "route" },
        { id: "workspace-tab", kind: "state" },
        { id: "detail-dialog", kind: "state" },
        { id: "advanced-disclosure", kind: "state" },
        { id: "virtual-record", kind: "state" },
        { id: "embedded-document", kind: "nested-resource" },
        { id: "source", kind: "target" },
      ],
    },
  };
  const handled = [];
  const verified = [];
  let virtualChecks = 0;
  const adapter = {
    revealStep: ({ step }) => handled.push(step.id),
    verifyStep: ({ step }) => {
      if (step.id === "virtual-record" && virtualChecks++ === 0) return false;
      verified.push(step.id);
      return step.kind === "target"
        ? { verified: true, exact: true, visible: true, targetKind: "document-segment" }
        : { verified: true };
    },
  };
  const result = await runNavigationReveal({
    adapter,
    destination,
    intent: {},
    pollIntervalMs: 1,
    stepTimeoutMs: 200,
  });
  assert.deepEqual(handled, destination.reveal.steps.map(({ id }) => id));
  assert.deepEqual(verified, destination.reveal.steps.map(({ id }) => id));
  assert.deepEqual(result.reveal.verifiedSteps, destination.reveal.steps.map(({ id }) => id));
});

test("0.2 validates action input/output and supports durable task adapters", async () => {
  const manifest = example();
  manifest.actions[0].taskSupport = "required";
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.manage"] },
    adapters: {
      action: {
        prepare: async () => ({ planId: "plan-task", status: "prepared", confirmation: "explicit", expiresAt: "2099-01-01T00:00:00.000Z" }),
        confirm: async () => ({ status: "working", task: { taskId: "task-1", status: "working", ttlMs: 60000 } }),
        cancel: async () => ({ status: "canceled" }),
        getTask: async ({ request }) => request.taskId === "task-input"
          ? { taskId: request.taskId, status: "input_required", inputRequests: { reason: { type: "elicitation" } } }
          : { taskId: request.taskId, status: "completed", result: { archived: true } },
        updateTask: async () => ({ acknowledged: true }),
        cancelTask: async () => ({ acknowledged: true }),
      },
    },
  });
  await assert.rejects(agent.prepareAction({ actionId: "orders.archive", input: {} }), /action-input-schema-invalid/);
  const plan = await agent.prepareAction({ actionId: "orders.archive", input: { orderReference: "opaque-order-1" } });
  assert.equal((await agent.confirmAction({ actionId: "orders.archive", planId: plan.planId, confirmation: true })).status, "working");
  assert.equal((await agent.getTask({ actionId: "orders.archive", taskId: "task-1" })).status, "completed");
  assert.equal((await agent.getTask({ actionId: "orders.archive", taskId: "task-input" })).status, "input_required");
  assert.deepEqual(
    await agent.updateTask({ actionId: "orders.archive", taskId: "task-input", inputResponses: { reason: "approved" } }),
    { acknowledged: true },
  );
  assert.deepEqual(await agent.cancelTask({ actionId: "orders.archive", taskId: "task-2" }), { acknowledged: true });
});

test("transport bindings preserve semantic IDs without exposing implementation selectors", async () => {
  const manifest = example();
  const context = { authenticated: true, permissions: ["orders.view", "orders.manage"] };
  const mcp = createMcpBinding(manifest, context);
  assert.equal(mcp.resourceTemplates[0].name, "orders");
  assert.ok(mcp.tools.some(({ name }) => name === "query.orders"));
  assert.ok(mcp.tools.some(({ name }) => name === "prepare.orders.archive"));
  assert.deepEqual(mcp.capabilities.extensions, {});
  assert.equal(JSON.stringify(mcp).includes("selector"), false);
  const arazzo = createArazzoBinding(manifest, {
    sourceDescriptions: [{ name: "siteAgentApi", type: "openapi", url: "/openapi.json" }],
    operationIds: {
      orders: "queryOrders",
      "orders.detail": "navigateOrderDetail",
      "orders.archive": "prepareOrderArchive",
    },
  });
  assert.equal(arazzo.workflows[0].workflowId, "orders.review-and-archive");
  assert.equal(arazzo.sourceDescriptions[0].type, "openapi");
  assert.throws(() => createArazzoBinding(manifest), /arazzo-source-descriptions-required/);
  assert.ok(createAsyncApiBinding(manifest).channels["orders.changed"]);

  const registered = [];
  const agent = createConformanceTarget(manifest).createAgent({ permissions: "authorized" });
  const handle = await registerWebMcpTools({
    document: { modelContext: { registerTool: async (tool) => registered.push(tool) } },
    agent,
  });
  assert.equal(registered.length, 2);
  assert.equal((await registered.find(({ name }) => name === "query.orders").execute({ filters: { status: "open" } })).total, 1);
  handle.unregister();
});

test("WebMCP registrations follow active capability revisions and clean up stale tools", async () => {
  const current = example();
  let notify;
  const agent = createSiteAgent({
    manifest: current,
    getManifest: () => current,
    subscribeCapabilities: (listener) => {
      notify = listener;
      return () => {};
    },
    context: { authenticated: true, permissions: ["orders.view", "orders.manage"] },
    adapters: {
      query: async () => ({ items: [], total: 0 }),
      action: { prepare: async () => ({}) },
    },
  });
  const registrations = [];
  const handle = await registerWebMcpTools({
    document: {
      modelContext: {
        registerTool: async (definition, registration) => registrations.push({ definition, registration }),
      },
    },
    agent,
  });
  assert.deepEqual(handle.registeredToolNames, ["prepare.orders.archive", "query.orders"]);

  current.capabilityRevision = "example-orders-2";
  current.queryResources[0].status = "sunset";
  await notify();
  assert.deepEqual(handle.registeredToolNames, ["prepare.orders.archive"]);
  assert.equal(registrations.find(({ definition }) => definition.name === "query.orders").registration.signal.aborted, true);

  handle.unregister();
  assert.equal(registrations.at(-1).registration.signal.aborted, true);
});

test("MCP task projection is extension-negotiated, server-directed, and non-listable", () => {
  const manifest = example();
  manifest.actions[0].taskSupport = "optional";
  const binding = createMcpBinding(manifest, { authenticated: true, permissions: ["orders.manage"] });
  assert.deepEqual(binding.capabilities.extensions, { "io.modelcontextprotocol/tasks": {} });
  assert.deepEqual(binding.taskContracts[0].methods, ["tasks/get", "tasks/update", "tasks/cancel"]);
  assert.equal(binding.taskContracts[0].serverDirected, true);
  assert.equal(binding.taskContracts[0].listing, false);
  assert.equal(Object.hasOwn(binding.tools.find(({ name }) => name === "prepare.orders.archive"), "execution"), false);
});

test("full conformance requires and records executable host proofs", async () => {
  const manifest = example();
  const result = await runSiteAgentConformance({ manifest, ...createConformanceTarget(manifest) });
  assert.equal(result.fullyConformant, true, JSON.stringify(result.errors));
  assert.equal(result.executionVerified, true);
  assert.equal(result.proofs.length, 18);
  assert.ok(result.proofs.every(({ status }) => status === "passed"));
});

test("full conformance proves nested query destinations end at their exact source", async () => {
  const manifest = nestedDocumentManifest();
  const result = await runSiteAgentConformance({ manifest, ...createConformanceTarget(manifest) });
  assert.equal(result.fullyConformant, true, JSON.stringify(result.errors));
  assert.ok(result.proofs.some(({ id, status }) => id === "query.nested-destination-reveal" && status === "passed"));
});

test("dynamic capability revisions take effect without recreating the agent", async () => {
  const current = example();
  let notify;
  const agent = createSiteAgent({
    manifest: current,
    getManifest: () => current,
    subscribeCapabilities: (listener) => {
      notify = listener;
      return () => {};
    },
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: { query: async () => ({ items: [], total: 0 }) },
  });
  const observed = [];
  const initial = await agent.getCapabilitySnapshot();
  assert.equal(initial.capabilityRevision, "example-orders-1");
  await agent.subscribeCapabilitySnapshots((snapshot) => { observed.push(snapshot.capabilityRevision); });
  assert.deepEqual(observed, ["example-orders-1"]);
  current.capabilityRevision = "example-orders-2";
  current.queryResources[0].status = "sunset";
  await notify();
  assert.deepEqual(observed, ["example-orders-1", "example-orders-2"]);
  await assert.rejects(agent.query({ resourceId: "orders" }), /query-capability-sunset/);
});

test("permission-filtered catalogs retain authorized navigation-only destinations", async () => {
  const manifest = example();
  manifest.navigationDestinations.push({
    id: "settings.help",
    description: "Open the exact staff help destination without requiring a query or action link",
    visibility: "authenticated",
    permissionsAll: ["orders.view"],
    route: "/settings/help/",
    precision: "surface",
    exact: true,
    targetKinds: ["help-surface"],
    stateSchema: { type: "object", additionalProperties: false },
  });
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: {},
  });
  const filtered = await agent.getCapabilities();
  assert.ok(filtered.navigationDestinations.some(({ id }) => id === "settings.help"));
});

test("cancellation and deadlines stop before host adapters and return structured problems", async () => {
  let calls = 0;
  const agent = createSiteAgent({
    manifest: example(),
    context: { authenticated: true, permissions: ["orders.view"] },
    adapters: { query: async () => { calls += 1; return { items: [], total: 0 }; } },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    agent.query({ resourceId: "orders", signal: controller.signal }),
    (error) => error instanceof SiteAgentProblem
      && error.code === "request-cancelled"
      && error.partialEffects === "none",
  );
  await assert.rejects(
    agent.query({ resourceId: "orders", deadlineAt: Date.now() - 1 }),
    (error) => error instanceof SiteAgentProblem
      && error.code === "deadline-exceeded"
      && error.retryable === true,
  );
  assert.equal(calls, 0);
});

test("complete coverage claims require independent resolved inventory evidence", () => {
  const manifest = example();
  let sequence = 0;
  const inventory = [
    ["query", "queryable", manifest.queryResources],
    ["navigation", "navigable", manifest.navigationDestinations],
    ["action", "executable", manifest.actions],
  ];
  const evidence = {
    source: "host-inventory",
    evidenceVersion: 2,
    inventoryBasis: "independent-user-surface",
    inventoryMethod: "rendered-state-crawl",
    stateCoverage: { discovered: 1, exercised: 1, viewports: ["desktop", "mobile-touch"] },
    inventoryDigest: "b".repeat(64),
    dimensions: inventory.map(([kind, , capabilities]) => ({
      kind,
      discovered: capabilities.length,
      covered: capabilities.length,
      exempted: 0,
      unresolved: 0,
    })),
    items: inventory.flatMap(([kind, disposition, capabilities]) => capabilities.map(({ id }) => ({
      kind,
      disposition,
      capabilityId: id,
      actorClass: "authorized-user",
      identifierHash: (++sequence).toString(16).padStart(64, "0"),
    }))),
  };
  assert.equal(validateCoverageEvidence(manifest, evidence).valid, true);
  evidence.items.find(({ kind }) => kind === "action").disposition = "navigable";
  evidence.dimensions[2] = {
    ...evidence.dimensions[2],
    covered: evidence.dimensions[2].covered - 1,
    unresolved: 1,
  };
  assert.match(
    validateCoverageEvidence(manifest, evidence).errors.join("\n"),
    /coverage-complete-claim-has-unresolved:action/,
  );
});

test("complete action coverage rejects navigation-only mappings and unreviewed restrictions", () => {
  const manifest = example();
  const action = manifest.actions[0];
  const base = {
    source: "host-inventory",
    evidenceVersion: 2,
    inventoryBasis: "independent-user-surface",
    inventoryMethod: "rendered-state-crawl",
    stateCoverage: { discovered: 1, exercised: 1, viewports: ["desktop", "mobile-touch"] },
    inventoryDigest: "c".repeat(64),
    dimensions: [
      { kind: "query", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
      { kind: "navigation", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
      { kind: "action", discovered: 1, covered: 0, exempted: 0, unresolved: 1 },
    ],
    items: [{
      kind: "action",
      identifierHash: "d".repeat(64),
      actorClass: "owner",
      disposition: "navigable",
      capabilityId: action.id,
    }],
  };
  assert.match(validateCoverageEvidence(manifest, base).errors.join("\n"), /coverage-complete-claim-has-unresolved:action/);

  const restricted = structuredClone(base);
  restricted.dimensions[2] = { kind: "action", discovered: 1, covered: 0, exempted: 1, unresolved: 0 };
  restricted.items[0] = {
    ...restricted.items[0],
    disposition: "restricted",
    restriction: { category: "technical-debt", reason: "No adapter exists yet." },
  };
  const errors = validateCoverageEvidence(manifest, restricted).errors.join("\n");
  assert.match(errors, /coverage-restriction-category-invalid/);
  assert.match(errors, /coverage-restriction-authority-required/);
  assert.match(errors, /coverage-restriction-reviewer-required/);
});

test("reviewed non-automatable actions remain fully accounted for", () => {
  const manifest = example();
  const evidence = {
    source: "host-inventory",
    evidenceVersion: 2,
    inventoryBasis: "independent-user-surface",
    inventoryMethod: "rendered-state-crawl",
    stateCoverage: { discovered: 1, exercised: 1, viewports: ["desktop", "mobile-touch"] },
    inventoryDigest: "e".repeat(64),
    dimensions: [
      { kind: "query", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
      { kind: "navigation", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
      { kind: "action", discovered: 1, covered: 0, exempted: 1, unresolved: 0 },
    ],
    items: [{
      kind: "action",
      identifierHash: "f".repeat(64),
      actorClass: "authorized-user",
      disposition: "restricted",
      restriction: {
        category: "physical-presence",
        reason: "The operator must physically inspect the item before approval.",
        authority: "center-safety-policy",
        reviewedByRole: "safety-owner",
        reviewedAt: "2026-08-29T00:00:00.000Z",
      },
    }],
  };
  const result = validateCoverageEvidence(manifest, evidence);
  assert.equal(result.valid, true);
  assert.equal(result.accountability.complete, true);
});

test("visible-surface and human-action completeness claims fail independently", () => {
  const manifest = example();
  manifest.conformance.coverage.humanActions = "partial";
  const evidence = {
    source: "host-inventory",
    evidenceVersion: 2,
    inventoryBasis: "independent-user-surface",
    inventoryMethod: "rendered-state-crawl",
    stateCoverage: { discovered: 1, exercised: 1, viewports: ["desktop", "mobile-touch"] },
    inventoryDigest: "9".repeat(64),
    dimensions: [
      { kind: "query", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
      { kind: "navigation", discovered: 1, covered: 0, exempted: 0, unresolved: 1 },
      { kind: "action", discovered: 0, covered: 0, exempted: 0, unresolved: 0 },
    ],
    items: [{
      kind: "navigation",
      identifierHash: "8".repeat(64),
      actorClass: "authorized-user",
      disposition: "unresolved",
    }],
  };
  assert.match(
    validateCoverageEvidence(manifest, evidence).errors.join("\n"),
    /coverage-complete-claim-has-unresolved:navigation/,
  );

  manifest.conformance.coverage.visibleSurfaces = "partial";
  manifest.conformance.coverage.humanActions = "complete";
  evidence.dimensions[1] = { kind: "navigation", discovered: 0, covered: 0, exempted: 0, unresolved: 0 };
  evidence.dimensions[2] = { kind: "action", discovered: 1, covered: 0, exempted: 0, unresolved: 1 };
  evidence.items[0] = {
    kind: "action",
    identifierHash: "7".repeat(64),
    actorClass: "authorized-user",
    disposition: "unresolved",
  };
  assert.match(
    validateCoverageEvidence(manifest, evidence).errors.join("\n"),
    /coverage-complete-claim-has-unresolved:action/,
  );
});
