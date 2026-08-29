function finiteNonNegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function ratio(passed, total) {
  return total ? Math.round((passed / total) * 10_000) / 100 : 100;
}

/**
 * Evaluates deterministic answer-and-retrieval evidence without using the
 * manifest itself as an oracle. Hosts supply expected facts and sources from
 * fixtures or independently reviewed records, then record what the model and
 * query broker actually returned.
 */
export function evaluateQueryQuality(evidence = {}, budgets = {}) {
  const cases = Array.isArray(evidence.cases) ? evidence.cases : [];
  const errors = [];
  const maxToolCalls = Math.max(1, Number(budgets.maxToolCallsPerAnswer || 1));
  const maxTransportCalls = Math.max(1, Number(budgets.maxTransportCallsPerAnswer || 1));
  const maxDurationMs = Math.max(50, Number(budgets.maxDurationMs || 12_000));
  const minimumAccuracy = Math.min(100, Math.max(0, Number(budgets.minimumAccuracyPercent ?? 100)));
  const minimumEvidenceCoverage = Math.min(100, Math.max(0, Number(budgets.minimumEvidenceCoveragePercent ?? 100)));
  let correct = 0;
  let expectedFacts = 0;
  let supportedFacts = 0;
  let toolCalls = 0;
  let transportCalls = 0;
  let internalRequests = 0;
  let deduplicatedRequests = 0;

  if (!cases.length) errors.push("query-quality-cases-required");
  for (const [index, testCase] of cases.entries()) {
    const id = String(testCase?.id || `case-${index + 1}`);
    if (testCase?.answerCorrect === true) correct += 1;
    else errors.push(`query-quality-answer-incorrect:${id}`);
    const expected = [...new Set(testCase?.expectedFacts || [])];
    const supported = new Set(testCase?.supportedFacts || []);
    expectedFacts += expected.length;
    supportedFacts += expected.filter((fact) => supported.has(fact)).length;
    if (expected.some((fact) => !supported.has(fact))) errors.push(`query-quality-evidence-incomplete:${id}`);
    const requiredSources = new Set(testCase?.requiredSources || []);
    const returnedSources = new Set(testCase?.returnedSources || []);
    if ([...requiredSources].some((source) => !returnedSources.has(source))) errors.push(`query-quality-source-missing:${id}`);
    if (testCase?.completeness === "unknown") errors.push(`query-quality-completeness-unknown:${id}`);
    if (testCase?.completeness === "partial" && testCase?.partialDisclosed !== true) {
      errors.push(`query-quality-partial-not-disclosed:${id}`);
    }
    for (const field of ["toolCalls", "transportCalls", "internalRequests", "deduplicatedRequests", "durationMs"]) {
      if (!finiteNonNegative(testCase?.[field])) errors.push(`query-quality-${field}-invalid:${id}`);
    }
    toolCalls += Number(testCase?.toolCalls || 0);
    transportCalls += Number(testCase?.transportCalls || 0);
    internalRequests += Number(testCase?.internalRequests || 0);
    deduplicatedRequests += Number(testCase?.deduplicatedRequests || 0);
    if (Number(testCase?.toolCalls || 0) > maxToolCalls) errors.push(`query-quality-tool-call-budget-exceeded:${id}`);
    if (Number(testCase?.transportCalls || 0) > maxTransportCalls) errors.push(`query-quality-transport-call-budget-exceeded:${id}`);
    if (Number(testCase?.durationMs || 0) > maxDurationMs) errors.push(`query-quality-duration-budget-exceeded:${id}`);
  }

  const accuracyPercent = ratio(correct, cases.length);
  const evidenceCoveragePercent = ratio(supportedFacts, expectedFacts);
  if (accuracyPercent < minimumAccuracy) errors.push("query-quality-accuracy-budget-failed");
  if (evidenceCoveragePercent < minimumEvidenceCoverage) errors.push("query-quality-evidence-coverage-budget-failed");
  return Object.freeze({
    valid: errors.length === 0,
    readiness: errors.length ? "not-ready" : "ready",
    cases: Object.freeze({ passed: correct, total: cases.length, accuracyPercent }),
    evidence: Object.freeze({ supported: supportedFacts, expected: expectedFacts, coveragePercent: evidenceCoveragePercent }),
    requests: Object.freeze({
      toolCalls,
      transportCalls,
      internalRequests,
      deduplicatedRequests,
      averageToolCalls: cases.length ? Math.round((toolCalls / cases.length) * 100) / 100 : 0,
      averageTransportCalls: cases.length ? Math.round((transportCalls / cases.length) * 100) / 100 : 0,
    }),
    errors: Object.freeze(errors),
  });
}
