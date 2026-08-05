import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicDiscoveryManifest,
  createSiteAgent,
  getSiteAgentConformance,
  validateSiteAgentManifest,
} from "../../src/site-agent.js";

function manifest() {
  return {
    standardVersion: "0.1",
    id: "test.site",
    name: "Test site",
    profiles: ["core", "query", "navigation", "action"],
    queryResources: [{
      id: "records",
      description: "Authorized test records for the current actor",
      visibility: "authenticated",
      permissionsAll: ["records.view"],
      permissionsAny: [],
      execution: "host",
      modes: ["records", "count"],
      filters: { query: { type: "string" } },
      sorts: ["name"],
      maxResults: 20,
      destinationId: "records.detail",
      "x-test": { storage: "must-not-be-public" },
    }],
    navigationDestinations: [{
      id: "records.detail",
      description: "Open and focus the exact requested test record",
      visibility: "authenticated",
      permissionsAll: ["records.view"],
      permissionsAny: [],
      route: "/records/",
      precision: "record",
      exact: true,
      targetKinds: ["record"],
    }],
    actions: [{
      id: "records.archive",
      description: "Archive one test record through the shared handler",
      visibility: "authenticated",
      permissionsAll: ["records.manage"],
      permissionsAny: [],
      risk: "consequential",
      confirmation: "explicit",
      reconciliation: {
        identity: "stable-reference",
        equivalent: "complete",
        nonConflicting: "rebase",
        conflicting: "reconfirm",
        missing: "complete-if-satisfied",
      },
      inputSchema: { type: "object" },
      destinationId: "records.detail",
    }],
    conformance: {
      claims: ["core", "query", "navigation", "action"],
      coverage: { visibleSurfaces: "complete", humanActions: "complete" },
    },
  };
}

test("validates all profiles but requires executable evidence for full conformance", () => {
  assert.deepEqual(validateSiteAgentManifest(manifest()), { valid: true, errors: [] });
  assert.equal(getSiteAgentConformance(manifest()).declaredComplete, true);
  assert.equal(getSiteAgentConformance(manifest()).fullyConformant, false);
});

test("rejects broad navigation targets and unconfirmed writes", () => {
  const value = manifest();
  value.navigationDestinations[0].exact = false;
  value.actions[0].confirmation = "none";
  const result = validateSiteAgentManifest(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("exact must be true")));
  assert.ok(result.errors.some((error) => error.includes("must require confirmation")));
});

test("public discovery removes authenticated capabilities and implementation extensions", () => {
  const value = manifest();
  value.queryResources.push({
    id: "public-copy",
    description: "Published static copy available without authentication",
    visibility: "public",
    permissionsAll: [],
    permissionsAny: [],
    execution: "local",
    modes: ["records"],
    filters: { query: { type: "string" } },
    sorts: [],
    "x-test": { source: "private-build-detail" },
  });
  const publicManifest = createPublicDiscoveryManifest(value);
  assert.deepEqual(publicManifest.queryResources.map(({ id }) => id), ["public-copy"]);
  assert.equal(JSON.stringify(publicManifest).includes("x-test"), false);
  assert.equal(validateSiteAgentManifest(publicManifest, { publicDocument: true }).valid, true);
});

test("executes query, exact navigation, action confirmation, and duplicate protection", async () => {
  const telemetry = [];
  const value = manifest();
  const agent = createSiteAgent({
    manifest: value,
    context: { authenticated: true, permissions: ["records.view", "records.manage"] },
    report: (event) => telemetry.push(event),
    adapters: {
      query: async ({ request }) => ({
        total: 1,
        items: [{ reference: "opaque-record-1", label: "Record one", fields: { status: "open", query: request.filters.query } }],
      }),
      navigation: async ({ intent }) => ({ exact: intent.target.reference === "opaque-record-1", visible: true }),
      action: {
        prepare: async () => ({ planId: "plan-1", status: "prepared", confirmation: "explicit", expiresAt: "2099-01-01T00:00:00.000Z" }),
        confirm: async () => ({ status: "confirmed", destination: { destinationId: "records.detail", target: { reference: "opaque-record-1" } } }),
        cancel: async () => ({ status: "canceled" }),
      },
    },
  });

  const query = await agent.query({ resourceId: "records", filters: { query: "one" } });
  assert.equal(query.items[0].destination.destinationId, "records.detail");
  assert.equal((await agent.navigate(query.items[0].destination)).visible, true);
  const plan = await agent.prepareAction({ actionId: "records.archive", target: { reference: "opaque-record-1" } });
  assert.equal(plan.confirmation, "explicit");
  assert.equal((await agent.confirmAction({ actionId: "records.archive", planId: plan.planId })).status, "confirmed");
  await assert.rejects(
    agent.confirmAction({ actionId: "records.archive", planId: plan.planId }),
    /action-plan-already-consumed/,
  );
  assert.ok(telemetry.every((event) => Object.keys(event).every((key) => ["profile", "capabilityId", "status", "durationMs", "failureCode"].includes(key))));
});

test("rechecks current permissions for every invocation", async () => {
  let allowed = true;
  const agent = createSiteAgent({
    manifest: manifest(),
    getContext: () => ({ authenticated: true, permissions: allowed ? ["records.view"] : [] }),
    adapters: { query: async () => ({ items: [] }) },
  });
  await agent.query({ resourceId: "records" });
  allowed = false;
  await assert.rejects(agent.query({ resourceId: "records" }), /capability-not-authorized/);
});

test("returns a replacement preview for a meaningful concurrent conflict", async () => {
  const agent = createSiteAgent({
    manifest: manifest(),
    context: { authenticated: true, permissions: ["records.manage"] },
    adapters: {
      action: {
        prepare: async () => ({ planId: "old-plan", status: "prepared", confirmation: "explicit", expiresAt: "2099-01-01T00:00:00.000Z" }),
        confirm: async () => ({
          status: "reconfirmation-required",
          reconciliation: "conflicting",
          replacementPlan: {
            planId: "new-plan",
            status: "prepared",
            confirmation: "explicit",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        }),
        cancel: async () => ({ status: "canceled" }),
      },
    },
  });
  const plan = await agent.prepareAction({ actionId: "records.archive", input: { reference: "opaque" } });
  const result = await agent.confirmAction({ actionId: "records.archive", planId: plan.planId });
  assert.equal(result.status, "reconfirmation-required");
  assert.equal(result.replacementPlan.planId, "new-plan");
});

test("rejects undeclared filters and unsafe adapter-authored destinations", async () => {
  const value = manifest();
  const context = { authenticated: true, permissions: ["records.view"] };
  const agent = createSiteAgent({
    manifest: value,
    context,
    adapters: { query: async () => ({ items: [{ reference: "opaque", destination: { destinationId: "records.detail", selector: "#secret" } }] }) },
  });
  await assert.rejects(agent.query({ resourceId: "records", filters: { path: "users/x" } }), /query-filter-not-supported/);
  await assert.rejects(agent.query({ resourceId: "records" }), /unsafe-destination-field/);
});
