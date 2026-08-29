function finiteNonNegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function ratio(passed, total) {
  return total ? Math.round((passed / total) * 10_000) / 100 : 100;
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

/**
 * Evaluates independently-authored action and navigation fixtures. A case is
 * intentionally outcome based: hosts record the requested steps and the
 * observed steps instead of treating the manifest or model trace as truth.
 */
export function evaluateActionQuality(evidence = {}, budgets = {}) {
  const cases = Array.isArray(evidence.cases) ? evidence.cases : [];
  const errors = [];
  const maxToolCalls = Math.max(1, Number(budgets.maxToolCallsPerRequest || 4));
  const maxTransportCalls = Math.max(1, Number(budgets.maxTransportCallsPerRequest || 4));
  const maxDurationMs = Math.max(50, Number(budgets.maxDurationMs || 15_000));
  const minimumPassRate = Math.min(100, Math.max(0, Number(budgets.minimumPassRatePercent ?? 100)));
  let passed = 0;
  let expectedSteps = 0;
  let verifiedSteps = 0;
  let toolCalls = 0;
  let transportCalls = 0;

  if (!cases.length) errors.push("action-quality-cases-required");
  for (const [index, testCase] of cases.entries()) {
    const id = String(testCase?.id || `case-${index + 1}`);
    const requested = Array.isArray(testCase?.requestedSteps) ? testCase.requestedSteps : [];
    const observed = Array.isArray(testCase?.observedSteps) ? testCase.observedSteps : [];
    const caseErrors = [];
    if (!requested.length) caseErrors.push("steps-required");
    if (requested.length !== observed.length) caseErrors.push("step-count-mismatch");
    for (let stepIndex = 0; stepIndex < requested.length; stepIndex += 1) {
      const expected = requested[stepIndex] || {};
      const actual = observed[stepIndex] || {};
      expectedSteps += 1;
      const exact = expected.capabilityId === actual.capabilityId
        && expected.kind === actual.kind
        && (expected.dependsOn ?? null) === (actual.dependsOn ?? null);
      if (!exact) caseErrors.push(`step-mismatch:${stepIndex + 1}`);
      else verifiedSteps += 1;
      if (actual.authorized !== true) caseErrors.push(`authorization-not-verified:${stepIndex + 1}`);
      if (expected.confirmationRequired === true) {
        if (actual.confirmationPresented !== true) caseErrors.push(`confirmation-not-presented:${stepIndex + 1}`);
        if (actual.confirmed !== true && actual.status === "completed") caseErrors.push(`completed-without-confirmation:${stepIndex + 1}`);
      }
      if (expected.mutationCount !== undefined && Number(actual.mutationCount) !== Number(expected.mutationCount)) {
        caseErrors.push(`mutation-count-mismatch:${stepIndex + 1}`);
      }
      if (actual.status === "completed" && actual.postconditionVerified !== true) {
        caseErrors.push(`postcondition-not-verified:${stepIndex + 1}`);
      }
      if (actual.status === "failed" && actual.failureDisclosed !== true) {
        caseErrors.push(`failure-not-disclosed:${stepIndex + 1}`);
      }
      if (actual.partialEffects === true && actual.partialEffectsDisclosed !== true) {
        caseErrors.push(`partial-effects-not-disclosed:${stepIndex + 1}`);
      }
    }
    if (testCase?.permissionFiltered !== true) caseErrors.push("permission-filtering-not-verified");
    if (testCase?.idempotencyVerified !== true) caseErrors.push("idempotency-not-verified");
    if (testCase?.truthfulSummary !== true) caseErrors.push("truthful-summary-not-verified");
    if (testCase?.finalStatus && TERMINAL.has(testCase.finalStatus) && testCase?.terminalStable !== true) {
      caseErrors.push("terminal-state-not-stable");
    }
    for (const field of ["toolCalls", "transportCalls", "durationMs"]) {
      if (!finiteNonNegative(testCase?.[field])) caseErrors.push(`${field}-invalid`);
    }
    toolCalls += Number(testCase?.toolCalls || 0);
    transportCalls += Number(testCase?.transportCalls || 0);
    if (Number(testCase?.toolCalls || 0) > maxToolCalls) caseErrors.push("tool-call-budget-exceeded");
    if (Number(testCase?.transportCalls || 0) > maxTransportCalls) caseErrors.push("transport-call-budget-exceeded");
    if (Number(testCase?.durationMs || 0) > maxDurationMs) caseErrors.push("duration-budget-exceeded");
    if (caseErrors.length) errors.push(...caseErrors.map((error) => `action-quality-${error}:${id}`));
    else passed += 1;
  }

  const passRatePercent = ratio(passed, cases.length);
  const stepAccuracyPercent = ratio(verifiedSteps, expectedSteps);
  if (passRatePercent < minimumPassRate) errors.push("action-quality-pass-rate-budget-failed");
  return Object.freeze({
    valid: errors.length === 0,
    readiness: errors.length ? "not-ready" : "ready",
    cases: Object.freeze({ passed, total: cases.length, passRatePercent }),
    steps: Object.freeze({ verified: verifiedSteps, expected: expectedSteps, accuracyPercent: stepAccuracyPercent }),
    requests: Object.freeze({
      toolCalls,
      transportCalls,
      averageToolCalls: cases.length ? Math.round((toolCalls / cases.length) * 100) / 100 : 0,
      averageTransportCalls: cases.length ? Math.round((transportCalls / cases.length) * 100) / 100 : 0,
    }),
    errors: Object.freeze(errors),
  });
}
