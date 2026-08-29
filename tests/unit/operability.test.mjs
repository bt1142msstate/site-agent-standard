import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_ACCESSIBILITY_RULES,
  validateSiteOperabilityEvidence,
} from "../../src/operability.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = () => JSON.parse(fs.readFileSync(path.join(root, "examples/basic/site-agent.json"), "utf8"));

function completeEvidence(value) {
  const navigation = value.navigationDestinations.flatMap((destination) => (
    ["desktop", "mobile-touch"].map((viewport) => ({
      destinationId: destination.id,
      viewport,
      exact: true,
      stateVerified: true,
      targetVisible: true,
      keyboardReachable: true,
      focusVisible: true,
      focusNotObscured: true,
      noKeyboardTrap: true,
      durationMs: 120,
      revealDepth: destination.reveal?.steps?.length || 0,
      violations: [],
    }))
  ));
  const queries = value.queryResources.map((resource) => ({
    resourceId: resource.id,
    execution: resource.execution,
    authorizedCase: true,
    deniedCase: true,
    filtersValidated: true,
    resultSchemaValidated: true,
    bounded: true,
    emptyState: true,
    errorState: true,
    provenanceVerified: true,
    durationMs: 80,
    violations: [],
  }));
  return {
    source: "independent-operability-run",
    inventoryDigest: "c".repeat(64),
    wcagConformanceClaim: "none",
    budgets: { navigationMs: 5000, queryMs: 1000 },
    scope: { viewports: ["desktop", "mobile-touch"], inputModes: ["keyboard", "programmatic"] },
    navigation,
    queries,
    accessibility: {
      assistiveTechnologyChecks: ["screen-reader-smoke"],
      rules: REQUIRED_ACCESSIBILITY_RULES.map((id, index) => ({
        id,
        mode: index % 2 ? "manual" : "automated",
        outcome: "passed",
        requirement: `Evidence for ${id}`,
      })),
    },
  };
}

test("complete independent operability evidence earns readiness without claiming WCAG conformance", () => {
  const value = manifest();
  const result = validateSiteOperabilityEvidence(value, completeEvidence(value));
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.readiness, "ready");
  assert.equal(result.operabilityScore, 100);
  assert.equal(result.dimensions.accessibilityEvidence.wcagConformanceClaim, "none");
});

test("operability fails closed for missing nested routes, inaccessible focus, and unproved queries", () => {
  const value = manifest();
  const evidence = completeEvidence(value);
  evidence.navigation[0].focusNotObscured = false;
  evidence.queries = [];
  evidence.accessibility.rules.find(({ id }) => id === "keyboard-operable").outcome = "failed";
  const result = validateSiteOperabilityEvidence(value, evidence);
  assert.equal(result.valid, false);
  assert.equal(result.readiness, "not-ready");
  assert.match(result.errors.join("\n"), /operability-navigation-failed/);
  assert.match(result.errors.join("\n"), /operability-query-evidence-missing/);
  assert.match(result.errors.join("\n"), /operability-accessibility-rule-failed:keyboard-operable/);
});

test("operability evidence cannot be presented as a WCAG conformance claim", () => {
  const value = manifest();
  const evidence = completeEvidence(value);
  evidence.wcagConformanceClaim = "AA";
  assert.match(
    validateSiteOperabilityEvidence(value, evidence).errors.join("\n"),
    /operability-must-not-claim-wcag-conformance/,
  );
});
