const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_ACCESSIBILITY_RULES = Object.freeze([
  "keyboard-operable",
  "no-keyboard-trap",
  "focus-order",
  "focus-visible",
  "focus-not-obscured",
  "name-role-value",
  "reflow",
  "target-size",
  "status-messages",
  "error-identification",
]);

function active(values) {
  return (values || []).filter(({ status }) => status !== "sunset");
}

function ratio(passed, total) {
  return total ? Math.round((passed / total) * 100) : 100;
}

function numeric(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function navigationPasses(run, budget) {
  return run?.exact === true
    && run?.stateVerified === true
    && run?.targetVisible === true
    && run?.keyboardReachable === true
    && run?.focusVisible === true
    && run?.focusNotObscured === true
    && run?.noKeyboardTrap === true
    && numeric(run?.durationMs)
    && Number(run.durationMs) <= budget
    && (!Array.isArray(run.violations) || run.violations.length === 0);
}

function queryPasses(run, budget) {
  return run?.authorizedCase === true
    && run?.deniedCase === true
    && run?.filtersValidated === true
    && run?.resultSchemaValidated === true
    && run?.bounded === true
    && run?.emptyState === true
    && run?.errorState === true
    && run?.provenanceVerified === true
    && numeric(run?.durationMs)
    && Number(run.durationMs) <= budget
    && (!Array.isArray(run.violations) || run.violations.length === 0);
}

/**
 * Validates independent, reproducible site-operability evidence. This report is
 * intentionally not a WCAG conformance claim: automated and sampled workflow
 * evidence can expose accessibility risk, but cannot replace a scoped WCAG
 * evaluation by qualified humans and assistive-technology users.
 */
export function validateSiteOperabilityEvidence(manifest = {}, evidence = {}) {
  const errors = [];
  const warnings = [];
  if (evidence.source !== "independent-operability-run") errors.push("operability-source-invalid");
  if (!DIGEST_PATTERN.test(String(evidence.inventoryDigest || ""))) errors.push("operability-inventory-digest-invalid");
  if (evidence.wcagConformanceClaim !== "none") errors.push("operability-must-not-claim-wcag-conformance");
  const navigationBudgetMs = Math.max(100, Number(evidence.budgets?.navigationMs || 10_000));
  const queryBudgetMs = Math.max(50, Number(evidence.budgets?.queryMs || 3_000));
  const viewports = [...new Set(evidence.scope?.viewports || [])];
  const inputModes = [...new Set(evidence.scope?.inputModes || [])];
  if (!viewports.includes("desktop") || !viewports.some((value) => /mobile|touch/.test(value))) {
    errors.push("operability-desktop-and-mobile-scope-required");
  }
  if (!inputModes.includes("keyboard") || !inputModes.includes("programmatic")) {
    errors.push("operability-keyboard-and-programmatic-scope-required");
  }

  const navigationRuns = Array.isArray(evidence.navigation) ? evidence.navigation : [];
  const expectedNavigation = active(manifest.navigationDestinations);
  let passingNavigation = 0;
  for (const destination of expectedNavigation) {
    const runs = navigationRuns.filter(({ destinationId }) => destinationId === destination.id);
    for (const viewport of viewports) {
      const run = runs.find((candidate) => candidate.viewport === viewport);
      if (!run) {
        errors.push(`operability-navigation-evidence-missing:${destination.id}:${viewport}`);
        continue;
      }
      if (navigationPasses(run, navigationBudgetMs)) passingNavigation += 1;
      else errors.push(`operability-navigation-failed:${destination.id}:${viewport}`);
      if (destination.reveal?.steps?.length && Number(run.revealDepth) !== destination.reveal.steps.length) {
        errors.push(`operability-reveal-depth-mismatch:${destination.id}:${viewport}`);
      }
    }
  }

  const queryRuns = Array.isArray(evidence.queries) ? evidence.queries : [];
  const expectedQueries = active(manifest.queryResources);
  let passingQueries = 0;
  for (const resource of expectedQueries) {
    const run = queryRuns.find(({ resourceId }) => resourceId === resource.id);
    if (!run) {
      errors.push(`operability-query-evidence-missing:${resource.id}`);
      continue;
    }
    if (run.execution !== resource.execution) errors.push(`operability-query-execution-mismatch:${resource.id}`);
    if (queryPasses(run, queryBudgetMs)) passingQueries += 1;
    else errors.push(`operability-query-failed:${resource.id}`);
  }
  const executionKinds = new Set(expectedQueries.map(({ execution }) => execution));
  if (executionKinds.has("local") && !queryRuns.some(({ execution }) => execution === "local")) {
    errors.push("operability-local-query-proof-required");
  }
  if (executionKinds.has("host") && !queryRuns.some(({ execution }) => execution === "host")) {
    errors.push("operability-host-query-proof-required");
  }

  const rules = Array.isArray(evidence.accessibility?.rules) ? evidence.accessibility.rules : [];
  const byRule = new Map(rules.map((rule) => [rule.id, rule]));
  let applicableRules = 0;
  let passingRules = 0;
  for (const ruleId of REQUIRED_ACCESSIBILITY_RULES) {
    const rule = byRule.get(ruleId);
    if (!rule) {
      errors.push(`operability-accessibility-rule-missing:${ruleId}`);
      continue;
    }
    if (!new Set(["automated", "manual", "hybrid"]).has(rule.mode)) {
      errors.push(`operability-accessibility-rule-mode-invalid:${ruleId}`);
    }
    if (!new Set(["passed", "failed", "inapplicable"]).has(rule.outcome)) {
      errors.push(`operability-accessibility-rule-outcome-invalid:${ruleId}`);
      continue;
    }
    if (!String(rule.requirement || "").trim()) errors.push(`operability-accessibility-requirement-missing:${ruleId}`);
    if (rule.outcome === "inapplicable") {
      if (!String(rule.reason || "").trim()) errors.push(`operability-accessibility-inapplicable-reason-missing:${ruleId}`);
      continue;
    }
    applicableRules += 1;
    if (rule.outcome === "passed") passingRules += 1;
    else errors.push(`operability-accessibility-rule-failed:${ruleId}`);
  }
  if (!rules.some(({ mode }) => mode === "manual" || mode === "hybrid")) {
    errors.push("operability-manual-accessibility-evidence-required");
  }
  if (!rules.some(({ mode }) => mode === "automated" || mode === "hybrid")) {
    errors.push("operability-automated-accessibility-evidence-required");
  }
  if (!(evidence.accessibility?.assistiveTechnologyChecks || []).length) {
    warnings.push("operability-assistive-technology-user-testing-not-recorded");
  }

  const navigationTotal = expectedNavigation.length * Math.max(1, viewports.length);
  const navigationScore = ratio(passingNavigation, navigationTotal);
  const queryScore = ratio(passingQueries, expectedQueries.length);
  const accessibilityTestPassRate = ratio(passingRules, applicableRules);
  const operabilityScore = Math.round((navigationScore * 0.45) + (queryScore * 0.35) + (accessibilityTestPassRate * 0.20));
  return Object.freeze({
    valid: errors.length === 0,
    readiness: errors.length ? "not-ready" : "ready",
    operabilityScore,
    dimensions: Object.freeze({
      navigation: Object.freeze({ passed: passingNavigation, total: navigationTotal, score: navigationScore }),
      query: Object.freeze({ passed: passingQueries, total: expectedQueries.length, score: queryScore }),
      accessibilityEvidence: Object.freeze({
        passed: passingRules,
        applicable: applicableRules,
        testedRulePassRate: accessibilityTestPassRate,
        wcagConformanceClaim: "none",
      }),
    }),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

export { REQUIRED_ACCESSIBILITY_RULES };
