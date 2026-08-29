import test from "node:test";
import assert from "node:assert/strict";
import { evaluateActionQuality } from "../../src/action-quality.js";

const complete = {
  id: "query-navigate-update",
  requestedSteps: [
    { capabilityId: "staff.search", kind: "query" },
    { capabilityId: "staff.profile", kind: "navigation", dependsOn: "staff.search" },
    { capabilityId: "staff.update", kind: "action", dependsOn: "staff.profile", confirmationRequired: true, mutationCount: 1 },
  ],
  observedSteps: [
    { capabilityId: "staff.search", kind: "query", authorized: true, status: "completed", postconditionVerified: true },
    { capabilityId: "staff.profile", kind: "navigation", dependsOn: "staff.search", authorized: true, status: "completed", postconditionVerified: true },
    { capabilityId: "staff.update", kind: "action", dependsOn: "staff.profile", confirmationRequired: true, mutationCount: 1, authorized: true, confirmationPresented: true, confirmed: true, status: "completed", postconditionVerified: true },
  ],
  permissionFiltered: true,
  idempotencyVerified: true,
  truthfulSummary: true,
  finalStatus: "completed",
  terminalStable: true,
  toolCalls: 3,
  transportCalls: 3,
  durationMs: 1200,
};

test("action quality accepts a verified compound sequence", () => {
  const report = evaluateActionQuality({ cases: [complete] });
  assert.equal(report.valid, true);
  assert.equal(report.steps.accuracyPercent, 100);
});

test("action quality fails unsafe or misleading execution", () => {
  const unsafe = structuredClone(complete);
  unsafe.observedSteps[2].confirmed = false;
  unsafe.observedSteps[2].postconditionVerified = false;
  unsafe.idempotencyVerified = false;
  unsafe.truthfulSummary = false;
  const report = evaluateActionQuality({ cases: [unsafe] });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /completed-without-confirmation/);
  assert.match(report.errors.join("\n"), /postcondition-not-verified/);
  assert.match(report.errors.join("\n"), /idempotency-not-verified/);
});

test("action quality requires explicit partial-effect disclosure", () => {
  const failed = structuredClone(complete);
  failed.observedSteps[2] = { ...failed.observedSteps[2], status: "failed", failureDisclosed: true, partialEffects: true, partialEffectsDisclosed: false };
  failed.finalStatus = "failed";
  const report = evaluateActionQuality({ cases: [failed] });
  assert.match(report.errors.join("\n"), /partial-effects-not-disclosed/);
});
