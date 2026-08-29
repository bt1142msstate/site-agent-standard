const REQUIRED_DIMENSIONS = ["query", "navigation", "action"];
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COVERED_DISPOSITION = Object.freeze({ query: "queryable", navigation: "navigable", action: "executable" });
const DISPOSITIONS = new Set(["queryable", "navigable", "executable", "restricted", "unresolved"]);
const RESTRICTION_CATEGORIES = new Set([
  "legal", "security", "privacy", "provider", "human-judgment", "physical-presence",
]);
const INVENTORY_METHODS = new Set(["rendered-state-crawl", "static-plus-runtime-sample", "static-source"]);

function count(value, label, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${label}-must-be-a-nonnegative-safe-integer`);
    return 0;
  }
  return value;
}

function capabilityIds(manifest, kind) {
  const values = kind === "query"
    ? manifest?.queryResources
    : kind === "navigation"
      ? manifest?.navigationDestinations
      : manifest?.actions;
  return new Set((values || []).map(({ id }) => id));
}

function validateAccountabilityItems(manifest, evidence, byKind, errors) {
  if (evidence.evidenceVersion !== 2) errors.push("coverage-accountability-evidence-version-must-be-2");
  if (evidence.inventoryBasis !== "independent-user-surface") {
    errors.push("coverage-inventory-basis-must-be-independent-user-surface");
  }
  if (!INVENTORY_METHODS.has(evidence.inventoryMethod)) errors.push("coverage-inventory-method-invalid");
  const items = Array.isArray(evidence.items) ? evidence.items : [];
  if (!items.length) errors.push("coverage-accountability-items-required");
  const seen = new Set();
  const itemCounts = new Map(REQUIRED_DIMENSIONS.map((kind) => [kind, {
    discovered: 0, covered: 0, exempted: 0, unresolved: 0,
  }]));

  for (const item of items) {
    const kind = String(item?.kind || "");
    if (!REQUIRED_DIMENSIONS.includes(kind)) {
      errors.push(`coverage-item-kind-invalid:${kind || "missing"}`);
      continue;
    }
    const identifierHash = String(item.identifierHash || "");
    const actorClass = String(item.actorClass || "").trim();
    if (!DIGEST_PATTERN.test(identifierHash)) errors.push(`coverage-item-identifier-hash-invalid:${kind}`);
    if (!actorClass) errors.push(`coverage-item-actor-class-required:${kind}`);
    const key = `${kind}\0${actorClass}\0${identifierHash}`;
    if (seen.has(key)) errors.push(`coverage-item-duplicate:${kind}:${identifierHash}`);
    seen.add(key);

    const disposition = String(item.disposition || "");
    if (!DISPOSITIONS.has(disposition)) {
      errors.push(`coverage-item-disposition-invalid:${kind}:${disposition || "missing"}`);
    }
    const counts = itemCounts.get(kind);
    counts.discovered += 1;
    if (disposition === COVERED_DISPOSITION[kind]) {
      counts.covered += 1;
      const capabilityId = String(item.capabilityId || "");
      if (!capabilityId) errors.push(`coverage-item-capability-required:${kind}:${identifierHash}`);
      else if (!capabilityIds(manifest, kind).has(capabilityId)) {
        errors.push(`coverage-item-capability-unknown:${kind}:${capabilityId}`);
      }
    } else if (disposition === "restricted") {
      counts.exempted += 1;
      const restriction = item.restriction || {};
      if (!RESTRICTION_CATEGORIES.has(restriction.category)) {
        errors.push(`coverage-restriction-category-invalid:${kind}:${identifierHash}`);
      }
      if (String(restriction.reason || "").trim().length < 12) {
        errors.push(`coverage-restriction-reason-required:${kind}:${identifierHash}`);
      }
      if (!String(restriction.authority || "").trim()) {
        errors.push(`coverage-restriction-authority-required:${kind}:${identifierHash}`);
      }
      if (!String(restriction.reviewedByRole || "").trim()) {
        errors.push(`coverage-restriction-reviewer-required:${kind}:${identifierHash}`);
      }
      if (!Number.isFinite(Date.parse(String(restriction.reviewedAt || "")))) {
        errors.push(`coverage-restriction-reviewed-at-invalid:${kind}:${identifierHash}`);
      }
    } else {
      // Query or Navigation support does not make a human Action executable.
      counts.unresolved += 1;
    }
  }

  for (const kind of REQUIRED_DIMENSIONS) {
    const dimension = byKind.get(kind);
    const observed = itemCounts.get(kind);
    if (!dimension) continue;
    for (const field of ["discovered", "covered", "exempted", "unresolved"]) {
      if (dimension[field] !== observed[field]) errors.push(`coverage-accountability-count-mismatch:${kind}:${field}`);
    }
  }
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

  const claimsVisibleSurfacesComplete = manifest?.conformance?.coverage?.visibleSurfaces === "complete";
  const claimsHumanActionsComplete = manifest?.conformance?.coverage?.humanActions === "complete";
  const hasAccountabilityItems = evidence.evidenceVersion !== undefined || evidence.items !== undefined;
  if (hasAccountabilityItems) {
    validateAccountabilityItems(manifest, evidence, byKind, errors);
  } else {
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
      if (dimension && dimension.exempted !== exemptionCounts.get(kind)) errors.push(`coverage-exemption-count-mismatch:${kind}`);
    }
  }

  if (claimsVisibleSurfacesComplete || claimsHumanActionsComplete) {
    if (!hasAccountabilityItems) errors.push("coverage-complete-claim-requires-itemized-accountability");
    if (evidence.inventoryMethod !== "rendered-state-crawl") {
      errors.push("coverage-complete-claim-requires-rendered-state-crawl");
    }
    const stateCoverage = evidence.stateCoverage || {};
    if (!Number.isSafeInteger(stateCoverage.discovered) || stateCoverage.discovered < 1) {
      errors.push("coverage-rendered-state-discovered-invalid");
    }
    if (stateCoverage.exercised !== stateCoverage.discovered) {
      errors.push("coverage-rendered-state-crawl-incomplete");
    }
    const viewports = new Set(stateCoverage.viewports || []);
    for (const viewport of ["desktop", "mobile-touch"]) {
      if (!viewports.has(viewport)) errors.push(`coverage-rendered-state-viewport-required:${viewport}`);
    }
  }
  if (claimsVisibleSurfacesComplete) {
    for (const kind of ["query", "navigation"]) {
      if ((byKind.get(kind)?.unresolved ?? 1) !== 0) errors.push(`coverage-complete-claim-has-unresolved:${kind}`);
    }
  }
  if (claimsHumanActionsComplete && (byKind.get("action")?.unresolved ?? 1) !== 0) {
    errors.push("coverage-complete-claim-has-unresolved:action");
  }
  if (claimsHumanActionsComplete && (byKind.get("action")?.exempted ?? 1) !== 0) {
    errors.push("coverage-complete-action-parity-disallows-restrictions");
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    dimensions: Object.freeze(Object.fromEntries(REQUIRED_DIMENSIONS.map((kind) => [kind, byKind.get(kind) || null]))),
    accountability: Object.freeze({
      itemized: hasAccountabilityItems,
      complete: hasAccountabilityItems && REQUIRED_DIMENSIONS.every((kind) => (byKind.get(kind)?.unresolved ?? 1) === 0),
    }),
  });
}
