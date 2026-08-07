const REQUIRED_DIMENSIONS = ["query", "navigation", "action"];
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function count(value, label, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${label}-must-be-a-nonnegative-safe-integer`);
    return 0;
  }
  return value;
}

export function validateCoverageEvidence(manifest, evidence = {}) {
  const errors = [];
  if (evidence.source !== "host-inventory") errors.push("coverage-source-must-be-host-inventory");
  if (!DIGEST_PATTERN.test(String(evidence.inventoryDigest || ""))) errors.push("coverage-inventory-digest-invalid");
  const dimensions = Array.isArray(evidence.dimensions) ? evidence.dimensions : [];
  const byKind = new Map();
  for (const dimension of dimensions) {
    const kind = String(dimension?.kind || "");
    if (!REQUIRED_DIMENSIONS.includes(kind)) {
      errors.push(`coverage-dimension-kind-invalid:${kind || "missing"}`);
      continue;
    }
    if (byKind.has(kind)) errors.push(`coverage-dimension-duplicate:${kind}`);
    byKind.set(kind, dimension);
    const discovered = count(dimension.discovered, `${kind}-discovered`, errors);
    const covered = count(dimension.covered, `${kind}-covered`, errors);
    const exempted = count(dimension.exempted, `${kind}-exempted`, errors);
    const unresolved = count(dimension.unresolved, `${kind}-unresolved`, errors);
    if (discovered !== covered + exempted + unresolved) errors.push(`coverage-dimension-count-mismatch:${kind}`);
  }
  for (const kind of REQUIRED_DIMENSIONS) {
    if (!byKind.has(kind)) errors.push(`coverage-dimension-required:${kind}`);
  }
  const exemptions = Array.isArray(evidence.exemptions) ? evidence.exemptions : [];
  const exemptionCounts = new Map(REQUIRED_DIMENSIONS.map((kind) => [kind, 0]));
  for (const exemption of exemptions) {
    if (!REQUIRED_DIMENSIONS.includes(exemption?.kind)) {
      errors.push("coverage-exemption-kind-invalid");
      continue;
    }
    if (!DIGEST_PATTERN.test(String(exemption.identifierHash || ""))) errors.push("coverage-exemption-identifier-hash-invalid");
    if (!String(exemption.reason || "").trim()) errors.push("coverage-exemption-reason-required");
    exemptionCounts.set(exemption.kind, exemptionCounts.get(exemption.kind) + 1);
  }
  for (const kind of REQUIRED_DIMENSIONS) {
    const dimension = byKind.get(kind);
    if (dimension && dimension.exempted !== exemptionCounts.get(kind)) {
      errors.push(`coverage-exemption-count-mismatch:${kind}`);
    }
  }
  const claimsComplete = manifest?.conformance?.coverage?.visibleSurfaces === "complete"
    && manifest?.conformance?.coverage?.humanActions === "complete";
  if (claimsComplete) {
    for (const kind of REQUIRED_DIMENSIONS) {
      if ((byKind.get(kind)?.unresolved ?? 1) !== 0) errors.push(`coverage-complete-claim-has-unresolved:${kind}`);
    }
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    dimensions: Object.freeze(Object.fromEntries(REQUIRED_DIMENSIONS.map((kind) => [kind, byKind.get(kind) || null]))),
  });
}
