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
  negotiateSiteAgentVersion,
  registerWebMcpTools,
  runSiteAgentConformance,
  validateSiteAgentManifest,
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
  assert.equal((await verifiedAgent.navigate(verifiedQuery.items[0].destination)).visible, true);
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

test("0.2 validates action input/output and supports durable task adapters", async () => {
  const manifest = example();
  manifest.actions[0].taskSupport = "required";
  const agent = createSiteAgent({
    manifest,
    context: { authenticated: true, permissions: ["orders.manage"] },
    adapters: {
      action: {
        prepare: async () => ({ planId: "plan-task", status: "prepared", confirmation: "explicit", expiresAt: "2099-01-01T00:00:00.000Z" }),
        confirm: async () => ({ status: "working", task: { taskId: "task-1", status: "working" } }),
        cancel: async () => ({ status: "canceled" }),
        getTask: async () => ({ taskId: "task-1", status: "completed", output: { archived: true } }),
        cancelTask: async () => ({ taskId: "task-2", status: "canceled" }),
      },
    },
  });
  await assert.rejects(agent.prepareAction({ actionId: "orders.archive", input: {} }), /action-input-schema-invalid/);
  const plan = await agent.prepareAction({ actionId: "orders.archive", input: { orderReference: "opaque-order-1" } });
  assert.equal((await agent.confirmAction({ actionId: "orders.archive", planId: plan.planId, confirmation: true })).status, "working");
  assert.equal((await agent.getTask({ actionId: "orders.archive", taskId: "task-1" })).status, "completed");
  assert.equal((await agent.cancelTask({ actionId: "orders.archive", taskId: "task-2" })).status, "canceled");
});

test("transport bindings preserve semantic IDs without exposing implementation selectors", async () => {
  const manifest = example();
  const context = { authenticated: true, permissions: ["orders.view", "orders.manage"] };
  const mcp = createMcpBinding(manifest, context);
  assert.equal(mcp.resourceTemplates[0].name, "orders");
  assert.ok(mcp.tools.some(({ name }) => name === "query.orders"));
  assert.ok(mcp.tools.some(({ name }) => name === "prepare.orders.archive"));
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

test("full conformance requires and records executable host proofs", async () => {
  const manifest = example();
  const result = await runSiteAgentConformance({ manifest, ...createConformanceTarget(manifest) });
  assert.equal(result.fullyConformant, true, JSON.stringify(result.errors));
  assert.equal(result.executionVerified, true);
  assert.equal(result.proofs.length, 10);
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
  let observed;
  await agent.subscribeCapabilities((manifest) => { observed = manifest.capabilityRevision; });
  current.capabilityRevision = "example-orders-2";
  current.queryResources[0].status = "sunset";
  await notify();
  assert.equal(observed, "example-orders-2");
  await assert.rejects(agent.query({ resourceId: "orders" }), /query-capability-sunset/);
});
