import { validateSchemaDefinition } from "./schema-validation.js";

export const SITE_AGENT_STANDARD_VERSION = "0.2";
export const SITE_AGENT_SUPPORTED_VERSIONS = Object.freeze(["0.1", "0.2"]);
export const SITE_AGENT_PROFILES = Object.freeze(["core", "query", "navigation", "action", "presentation", "operability"]);

export function negotiateSiteAgentVersion(offeredVersions, supportedVersions = SITE_AGENT_SUPPORTED_VERSIONS) {
  const offered = Array.isArray(offeredVersions) ? offeredVersions : [offeredVersions];
  const supported = new Set(supportedVersions);
  return [...offered].reverse().find((version) => supported.has(version)) || null;
}

const idPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const precisions = new Set(["control", "field", "record", "record-page", "surface"]);
const risks = new Set(["read", "reversible", "consequential", "destructive"]);
const confirmations = new Set(["none", "explicit", "typed"]);
const visibilities = new Set(["public", "authenticated"]);
const lifecycleStatuses = new Set(["active", "deprecated", "sunset"]);
const taskSupportValues = new Set(["forbidden", "optional", "required"]);
const freshnessModes = new Set(["static", "snapshot", "live"]);
const materializationBases = new Set(["rendered-user-surface", "canonical-structured-source", "document-text", "external"]);
const materializationStages = new Set(["build", "runtime", "request"]);
const nestedDestinationModes = new Set(["exact-reveal-required", "not-applicable"]);
const revealStepKinds = new Set(["route", "state", "nested-resource", "target"]);
const reconciliationValues = Object.freeze({
  identity: new Set(["stable-reference"]),
  equivalent: new Set(["complete"]),
  nonConflicting: new Set(["rebase", "reconfirm"]),
  conflicting: new Set(["reconfirm", "reject"]),
  missing: new Set(["complete-if-satisfied", "reconfirm", "reject"]),
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hasPermission(capability, context = {}) {
  const permissions = new Set(context.permissions || []);
  const all = capability.permissionsAll || [];
  const any = capability.permissionsAny || [];
  return all.every((permission) => permissions.has(permission))
    && (!any.length || any.some((permission) => permissions.has(permission)));
}

export function isCapabilityAuthorized(capability, context = {}) {
  if (!capability) return false;
  if (capability.visibility === "authenticated" && !context.authenticated) return false;
  return hasPermission(capability, context);
}

function validateCommon(capability, path, errors) {
  if (!isObject(capability)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!idPattern.test(String(capability.id || ""))) errors.push(`${path}.id must be a stable lowercase capability ID.`);
  if (String(capability.description || "").trim().length < 8) errors.push(`${path}.description must explain the capability.`);
  if (!visibilities.has(capability.visibility)) errors.push(`${path}.visibility must be public or authenticated.`);
  if (capability.status !== undefined && !lifecycleStatuses.has(capability.status)) errors.push(`${path}.status is invalid.`);
  if (capability.status === "deprecated" && !capability.replacedBy && !capability.sunsetAt) {
    errors.push(`${path} must declare replacedBy or sunsetAt when deprecated.`);
  }
  for (const field of ["permissionsAll", "permissionsAny"]) {
    if (capability[field] !== undefined && (!Array.isArray(capability[field]) || capability[field].some((value) => typeof value !== "string"))) {
      errors.push(`${path}.${field} must be an array of permission IDs.`);
    }
  }
}

function validateJsonSchema(schema, path, errors) {
  if (!isObject(schema)) {
    errors.push(`${path} must be a JSON Schema object.`);
    return;
  }
  const result = validateSchemaDefinition(schema);
  if (!result.valid) errors.push(`${path} is not valid JSON Schema 2020-12: ${result.errors.join("; ")}`);
}

function validateManifestInternal(manifest, options = {}) {
  const errors = [];
  if (!isObject(manifest)) return { valid: false, errors: ["Manifest must be a JSON object."] };
  if (!SITE_AGENT_SUPPORTED_VERSIONS.includes(manifest.standardVersion)) {
    errors.push(`standardVersion must be one of ${SITE_AGENT_SUPPORTED_VERSIONS.join(", ")}.`);
  }
  const strictV02 = manifest.standardVersion === "0.2";
  if (strictV02 && !/^\d+\.\d+\.\d+$/.test(String(manifest.manifestVersion || ""))) {
    errors.push("manifestVersion must be a semantic version for standardVersion 0.2.");
  }
  if (strictV02 && !String(manifest.capabilityRevision || "").trim()) {
    errors.push("capabilityRevision is required for standardVersion 0.2.");
  }
  if (!idPattern.test(String(manifest.id || ""))) errors.push("id must be a stable lowercase site ID.");
  if (!String(manifest.name || "").trim()) errors.push("name is required.");
  if (!Array.isArray(manifest.profiles) || !manifest.profiles.includes("core")) errors.push("profiles must include core.");
  for (const profile of manifest.profiles || []) {
    if (!SITE_AGENT_PROFILES.includes(profile)) errors.push(`Unknown profile: ${profile}.`);
  }

  const queryResources = Array.isArray(manifest.queryResources) ? manifest.queryResources : [];
  const destinations = Array.isArray(manifest.navigationDestinations) ? manifest.navigationDestinations : [];
  const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
  if (!options.publicDocument && manifest.profiles?.includes("query") && !queryResources.length) errors.push("The query profile requires queryResources.");
  if (!options.publicDocument && manifest.profiles?.includes("navigation") && !destinations.length) errors.push("The navigation profile requires navigationDestinations.");
  if (!options.publicDocument && manifest.profiles?.includes("action") && !actions.length) errors.push("The action profile requires actions.");
  if (manifest.profiles?.includes("operability")) {
    const operability = manifest.operability;
    if (!manifest.profiles.includes("query") || !manifest.profiles.includes("navigation")) {
      errors.push("The operability profile requires query and navigation profiles.");
    }
    if (!isObject(operability)) {
      errors.push("The operability profile requires an operability declaration.");
    } else {
      if (operability.evidenceSource !== "independent-operability-run") errors.push("operability.evidenceSource is invalid.");
      if (operability.coverage !== "all-active-capabilities") errors.push("operability.coverage must include all active capabilities.");
      if (!Array.isArray(operability.viewports) || !operability.viewports.includes("desktop")
        || !operability.viewports.some((value) => /mobile|touch/.test(value))) {
        errors.push("operability.viewports must include desktop and a mobile or touch viewport.");
      }
      if (!Array.isArray(operability.inputModes) || !operability.inputModes.includes("keyboard")
        || !operability.inputModes.includes("programmatic")) {
        errors.push("operability.inputModes must include keyboard and programmatic navigation.");
      }
      if (operability.accessibilityRules !== "act-compatible-automated-and-manual") errors.push("operability.accessibilityRules is invalid.");
      if (operability.wcagConformanceClaim !== false) errors.push("operability.wcagConformanceClaim must be false.");
      if (!Number.isInteger(operability.navigationBudgetMs) || operability.navigationBudgetMs < 100) errors.push("operability.navigationBudgetMs is invalid.");
      if (!Number.isInteger(operability.queryBudgetMs) || operability.queryBudgetMs < 50) errors.push("operability.queryBudgetMs is invalid.");
    }
  }
  if (manifest.profiles?.includes("presentation")) {
    const presentation = manifest.presentation;
    if (!isObject(presentation)) {
      errors.push("The presentation profile requires a presentation declaration.");
    } else {
      for (const field of [
        "preset",
        "cursor",
        "cursorMotion",
        "frameTarget",
        "clickFeedback",
        "clickSound",
        "scrollMotion",
        "inputPresentation",
        "typingSound",
      ]) {
        if (!String(presentation[field] || "").trim()) errors.push(`presentation.${field} is required.`);
      }
      if (!Array.isArray(presentation.responsiveVariants) || !presentation.responsiveVariants.length) {
        errors.push("presentation.responsiveVariants must not be empty.");
      }
      if (!Array.isArray(presentation.supportedThemes) || !presentation.supportedThemes.length) {
        errors.push("presentation.supportedThemes must not be empty.");
      }
      const visualQuality = presentation.visualQuality;
      if (!isObject(visualQuality)) {
        errors.push("presentation.visualQuality is required.");
      } else {
        const requiredVisualQuality = {
          source: "browser-computed-style",
          mappedStates: "all",
          viewports: "all-responsive-variants",
          themes: "all-supported",
          visibleLabels: "required",
          contrast: "wcag-2.2-aa",
        };
        for (const [field, expected] of Object.entries(requiredVisualQuality)) {
          if (visualQuality[field] !== expected) {
            errors.push(`presentation.visualQuality.${field} must be ${expected}.`);
          }
        }
      }
      if (presentation.muteSupported !== true) errors.push("presentation.muteSupported must be true.");
      if (presentation.reducedMotionSupported !== true) errors.push("presentation.reducedMotionSupported must be true.");
    }
  }

  const destinationIds = new Set();
  destinations.forEach((destination, index) => {
    const path = `navigationDestinations[${index}]`;
    validateCommon(destination, path, errors);
    if (destinationIds.has(destination.id)) errors.push(`${path}.id is duplicated.`);
    destinationIds.add(destination.id);
    if (!String(destination.route || "").startsWith("/")) errors.push(`${path}.route must be an origin-relative route.`);
    if (!precisions.has(destination.precision)) errors.push(`${path}.precision is invalid.`);
    if (destination.exact !== true) errors.push(`${path}.exact must be true; broad fallback targets do not conform.`);
    if (!Array.isArray(destination.targetKinds) || !destination.targetKinds.length) errors.push(`${path}.targetKinds must declare at least one semantic target.`);
    if (destination.reveal !== undefined) {
      const reveal = destination.reveal;
      if (!isObject(reveal) || reveal.mode !== "nested") {
        errors.push(`${path}.reveal.mode must be nested.`);
      } else {
        const steps = Array.isArray(reveal.steps) ? reveal.steps : [];
        if (steps.length < 3) errors.push(`${path}.reveal.steps must declare a complete nested reveal path.`);
        if (steps[0]?.kind !== "route") errors.push(`${path}.reveal.steps must begin with route.`);
        if (steps.at(-1)?.kind !== "target") errors.push(`${path}.reveal.steps must end with target.`);
        if (!steps.some(({ kind }) => kind === "nested-resource")) errors.push(`${path}.reveal.steps must include nested-resource.`);
        const stepIds = new Set();
        steps.forEach((step, stepIndex) => {
          const stepPath = `${path}.reveal.steps[${stepIndex}]`;
          if (!isObject(step) || !idPattern.test(String(step.id || ""))) errors.push(`${stepPath}.id is invalid.`);
          if (stepIds.has(step.id)) errors.push(`${stepPath}.id is duplicated.`);
          stepIds.add(step.id);
          if (!revealStepKinds.has(step.kind)) errors.push(`${stepPath}.kind is invalid.`);
          if (step.timeoutMs !== undefined
            && (!Number.isInteger(step.timeoutMs) || step.timeoutMs < 100 || step.timeoutMs > 30_000)) {
            errors.push(`${stepPath}.timeoutMs is invalid.`);
          }
          if (step.kind === "state") {
            if (!Array.isArray(step.stateKeys) || !step.stateKeys.length) errors.push(`${stepPath}.stateKeys must not be empty.`);
            for (const key of step.stateKeys || []) {
              if (!Object.hasOwn(destination.stateSchema?.properties || {}, key)) errors.push(`${stepPath}.stateKeys references undeclared state ${key}.`);
            }
          }
        });
        const finalKinds = new Set(steps.at(-1)?.targetKinds || []);
        if (!destination.targetKinds.some((kind) => finalKinds.has(kind))) {
          errors.push(`${path}.reveal final targetKinds must include a declared destination target kind.`);
        }
        if (reveal.verification !== "each-step-and-final-target") errors.push(`${path}.reveal.verification is invalid.`);
        if (reveal.outerSurfaceFallback !== false) errors.push(`${path}.reveal.outerSurfaceFallback must be false.`);
      }
    }
  });

  const queryIds = new Set();
  queryResources.forEach((resource, index) => {
    const path = `queryResources[${index}]`;
    validateCommon(resource, path, errors);
    if (queryIds.has(resource.id)) errors.push(`${path}.id is duplicated.`);
    queryIds.add(resource.id);
    if (!new Set(["local", "host"]).has(resource.execution)) errors.push(`${path}.execution must be local or host.`);
    if (!Array.isArray(resource.modes) || !resource.modes.length) errors.push(`${path}.modes must not be empty.`);
    const declaredModes = new Set(resource.modes || []);
    for (const [coverageIndex, coverage] of (resource.modeCoverage || []).entries()) {
      if (!declaredModes.has(coverage?.mode)) errors.push(`${path}.modeCoverage[${coverageIndex}].mode is not declared.`);
      for (const coveredMode of coverage?.covers || []) {
        if (!declaredModes.has(coveredMode)) errors.push(`${path}.modeCoverage[${coverageIndex}].covers references undeclared mode ${coveredMode}.`);
      }
    }
    if (!isObject(resource.filters)) errors.push(`${path}.filters must be an object of semantic filter schemas.`);
    const selectableFields = new Set(resource.selectableFields || []);
    for (const field of resource.defaultFields || []) {
      if (!selectableFields.has(field)) errors.push(`${path}.defaultFields references non-selectable field ${field}.`);
    }
    if (resource.batching?.consistency === "snapshot" && resource.freshness?.mode === "live") {
      errors.push(`${path}.batching cannot claim snapshot consistency for a live resource.`);
    }
    for (const field of ["aliases", "keywords", "examples"]) {
      if (resource[field] !== undefined && (!Array.isArray(resource[field])
        || resource[field].some((value) => !String(value || "").trim())
        || new Set(resource[field]).size !== resource[field].length)) {
        errors.push(`${path}.${field} must contain unique non-empty strings.`);
      }
    }
    for (const [filterId, filterSchema] of Object.entries(resource.filters || {})) {
      validateJsonSchema(filterSchema, `${path}.filters.${filterId}`, errors);
    }
    if (resource.destinationId && !destinationIds.has(resource.destinationId)) errors.push(`${path}.destinationId is unknown.`);
    if (resource.resultTargetKind && !resource.destinationId) errors.push(`${path}.resultTargetKind requires destinationId.`);
    if (resource.destinationId && destinationIds.has(resource.destinationId)) {
      const destination = destinations.find(({ id }) => id === resource.destinationId);
      if (resource.resultTargetKind && !destination.targetKinds.includes(resource.resultTargetKind)) {
        errors.push(`${path}.resultTargetKind is not allowed by its destination.`);
      }
    }
    if (resource.resultSchema !== undefined) validateJsonSchema(resource.resultSchema, `${path}.resultSchema`, errors);
    if (strictV02) {
      validateJsonSchema(resource.resultSchema, `${path}.resultSchema`, errors);
      if (!isObject(resource.pagination) || !new Set(["none", "cursor"]).has(resource.pagination.style)) {
        errors.push(`${path}.pagination.style must be none or cursor for standardVersion 0.2.`);
      }
      if (!isObject(resource.freshness) || !freshnessModes.has(resource.freshness.mode)) {
        errors.push(`${path}.freshness.mode must be static, snapshot, or live for standardVersion 0.2.`);
      }
      if (resource.execution === "local" && resource.freshness?.mode === "static") {
        const materialization = resource.materialization;
        if (!isObject(materialization)) {
          errors.push(`${path}.materialization is required for a local static Query resource.`);
        } else {
          if (!materializationBases.has(materialization.basis)) errors.push(`${path}.materialization.basis is invalid.`);
          if (!materializationStages.has(materialization.stage)) errors.push(`${path}.materialization.stage is invalid.`);
          if (!new Set(["required", "not-applicable"]).has(materialization.surfaceParity)) errors.push(`${path}.materialization.surfaceParity is invalid.`);
          if (!new Set(["resolved", "not-applicable"]).has(materialization.nestedContent)) errors.push(`${path}.materialization.nestedContent is invalid.`);
          if (!nestedDestinationModes.has(materialization.nestedDestination)) errors.push(`${path}.materialization.nestedDestination is invalid.`);
          if (materialization.basis === "rendered-user-surface"
            && (materialization.surfaceParity !== "required" || materialization.nestedContent !== "resolved")) {
            errors.push(`${path}.materialization must require surface parity and resolved nested content for rendered user surfaces.`);
          }
          if (materialization.nestedDestination === "exact-reveal-required" && materialization.nestedContent !== "resolved") {
            errors.push(`${path}.materialization must resolve nested content before requiring an exact reveal destination.`);
          }
        }
      }
    }
  });

  queryResources.forEach((resource, index) => {
    if (resource.materialization?.nestedDestination !== "exact-reveal-required") return;
    const destination = destinations.find(({ id }) => id === resource.destinationId);
    if (!destination?.reveal || destination.reveal.mode !== "nested") {
      errors.push(`queryResources[${index}] requires a nested reveal contract on destination ${resource.destinationId || "(missing)"}.`);
    }
  });

  const actionIds = new Set();
  actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    validateCommon(action, path, errors);
    if (actionIds.has(action.id)) errors.push(`${path}.id is duplicated.`);
    actionIds.add(action.id);
    if (!risks.has(action.risk)) errors.push(`${path}.risk is invalid.`);
    if (!confirmations.has(action.confirmation)) errors.push(`${path}.confirmation is invalid.`);
    validateJsonSchema(action.inputSchema, `${path}.inputSchema`, errors);
    if (action.outputSchema !== undefined) validateJsonSchema(action.outputSchema, `${path}.outputSchema`, errors);
    if (!isObject(action.reconciliation)) {
      errors.push(`${path}.reconciliation must declare stable conflict handling.`);
    } else {
      for (const [field, values] of Object.entries(reconciliationValues)) {
        if (!values.has(action.reconciliation[field])) errors.push(`${path}.reconciliation.${field} is invalid.`);
      }
    }
    if (action.destinationId && !destinationIds.has(action.destinationId)) errors.push(`${path}.destinationId is unknown.`);
    if (action.risk !== "read" && action.confirmation === "none") errors.push(`${path} must require confirmation for a state-changing action.`);
    if (strictV02) {
      validateJsonSchema(action.outputSchema, `${path}.outputSchema`, errors);
      if (!taskSupportValues.has(action.taskSupport)) errors.push(`${path}.taskSupport is required for standardVersion 0.2.`);
      if (!Array.isArray(action.sideEffects)) errors.push(`${path}.sideEffects must be an array for standardVersion 0.2.`);
    }
  });

  destinations.forEach((destination, index) => {
    if (destination.stateSchema !== undefined) validateJsonSchema(destination.stateSchema, `navigationDestinations[${index}].stateSchema`, errors);
    if (strictV02) validateJsonSchema(destination.stateSchema, `navigationDestinations[${index}].stateSchema`, errors);
  });

  const eventIds = new Set();
  for (const [index, event] of (manifest.events || []).entries()) {
    const path = `events[${index}]`;
    validateCommon(event, path, errors);
    if (eventIds.has(event.id)) errors.push(`${path}.id is duplicated.`);
    eventIds.add(event.id);
    validateJsonSchema(event.payloadSchema, `${path}.payloadSchema`, errors);
  }

  queryResources.forEach((resource, index) => {
    for (const eventId of resource.freshness?.eventIds || []) {
      if (!eventIds.has(eventId)) errors.push(`queryResources[${index}].freshness.eventIds references unknown event ${eventId}.`);
    }
    for (const relationshipId of resource.relationships || []) {
      if (!queryIds.has(relationshipId)) errors.push(`queryResources[${index}].relationships references unknown query resource ${relationshipId}.`);
    }
  });

  const capabilityIds = new Set([...queryIds, ...destinationIds, ...actionIds]);
  for (const [group, values] of [["queryResources", queryResources], ["navigationDestinations", destinations], ["actions", actions]]) {
    values.forEach((capability, index) => {
      if (capability.replacedBy && !capabilityIds.has(capability.replacedBy)) {
        errors.push(`${group}[${index}].replacedBy references unknown capability ${capability.replacedBy}.`);
      }
    });
  }
  const workflowIds = new Set();
  for (const [index, workflow] of (manifest.workflows || []).entries()) {
    const path = `workflows[${index}]`;
    validateCommon(workflow, path, errors);
    if (workflowIds.has(workflow.id)) errors.push(`${path}.id is duplicated.`);
    workflowIds.add(workflow.id);
    if (!Array.isArray(workflow.steps) || !workflow.steps.length) errors.push(`${path}.steps must not be empty.`);
    const hasMultiActorDeclaration = workflow.actors !== undefined
      || workflow.contexts !== undefined
      || workflow.synchronization !== undefined;
    const actorIds = new Set();
    const contextIds = new Set();
    if (hasMultiActorDeclaration) {
      if (!Array.isArray(workflow.actors) || !workflow.actors.length) errors.push(`${path}.actors must not be empty.`);
      if (!Array.isArray(workflow.contexts) || !workflow.contexts.length) errors.push(`${path}.contexts must not be empty.`);
      for (const [actorIndex, actor] of (workflow.actors || []).entries()) {
        if (!idPattern.test(String(actor.id || ""))) errors.push(`${path}.actors[${actorIndex}].id is invalid.`);
        if (actorIds.has(actor.id)) errors.push(`${path}.actors[${actorIndex}].id is duplicated.`);
        actorIds.add(actor.id);
        if (!String(actor.role || "").trim()) errors.push(`${path}.actors[${actorIndex}].role is required.`);
      }
      for (const [contextIndex, context] of (workflow.contexts || []).entries()) {
        if (!idPattern.test(String(context.id || ""))) errors.push(`${path}.contexts[${contextIndex}].id is invalid.`);
        if (contextIds.has(context.id)) errors.push(`${path}.contexts[${contextIndex}].id is duplicated.`);
        contextIds.add(context.id);
        if (!actorIds.has(context.actorId)) errors.push(`${path}.contexts[${contextIndex}].actorId is unknown.`);
        if (!new Set(["client", "operations"]).has(context.kind)) errors.push(`${path}.contexts[${contextIndex}].kind is invalid.`);
      }
      const synchronization = workflow.synchronization;
      if (!isObject(synchronization)
        || synchronization.timeline !== "shared-monotonic"
        || synchronization.barriers !== "step-boundaries"
        || synchronization.recording !== "all-contexts") {
        errors.push(`${path}.synchronization must declare the shared multi-context timeline.`);
      }
      const contextKinds = new Set((workflow.contexts || []).map(({ kind }) => kind));
      if ((workflow.actors || []).length > 1 && (!contextKinds.has("client") || !contextKinds.has("operations"))) {
        errors.push(`${path} multi-actor workflows require client and operations contexts.`);
      }
    }
    const stepIds = new Set();
    for (const [stepIndex, step] of (workflow.steps || []).entries()) {
      if (!idPattern.test(String(step.id || ""))) errors.push(`${path}.steps[${stepIndex}].id is invalid.`);
      if (stepIds.has(step.id)) errors.push(`${path}.steps[${stepIndex}].id is duplicated.`);
      stepIds.add(step.id);
      if (!capabilityIds.has(step.capabilityId)) errors.push(`${path}.steps[${stepIndex}].capabilityId is unknown.`);
      if (hasMultiActorDeclaration) {
        if (!actorIds.has(step.actorId)) errors.push(`${path}.steps[${stepIndex}].actorId is unknown.`);
        if (!contextIds.has(step.contextId)) errors.push(`${path}.steps[${stepIndex}].contextId is unknown.`);
        const context = (workflow.contexts || []).find(({ id }) => id === step.contextId);
        if (context && context.actorId !== step.actorId) {
          errors.push(`${path}.steps[${stepIndex}] actorId does not own contextId ${step.contextId}.`);
        }
      }
    }
    for (const [stepIndex, step] of (workflow.steps || []).entries()) {
      for (const dependency of step.dependsOn || []) {
        if (!stepIds.has(dependency)) errors.push(`${path}.steps[${stepIndex}].dependsOn references unknown step ${dependency}.`);
        if (dependency === step.id) errors.push(`${path}.steps[${stepIndex}] cannot depend on itself.`);
      }
      for (const target of [step.onSuccess, step.onFailure].filter(Boolean)) {
        if (!stepIds.has(target)) errors.push(`${path}.steps[${stepIndex}] references unknown transition step ${target}.`);
      }
    }
    const byId = new Map((workflow.steps || []).map((step) => [step.id, step]));
    const visiting = new Set();
    const visited = new Set();
    const visit = (stepId) => {
      if (visiting.has(stepId)) return false;
      if (visited.has(stepId)) return true;
      visiting.add(stepId);
      for (const dependency of byId.get(stepId)?.dependsOn || []) {
        if (byId.has(dependency) && !visit(dependency)) return false;
      }
      visiting.delete(stepId);
      visited.add(stepId);
      return true;
    };
    for (const stepId of stepIds) {
      if (!visit(stepId)) {
        errors.push(`${path}.steps contains a dependency cycle.`);
        break;
      }
    }
  }

  if (options.publicDocument) {
    for (const [group, values] of [["queryResources", queryResources], ["navigationDestinations", destinations], ["actions", actions]]) {
      values.forEach((value, index) => {
        if (value.visibility !== "public") errors.push(`${group}[${index}] exposes a non-public capability.`);
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateSiteAgentManifest(manifest, options = {}) {
  return validateManifestInternal(manifest, options);
}

export function assertSiteAgentManifest(manifest, options = {}) {
  const result = validateSiteAgentManifest(manifest, options);
  if (!result.valid) throw new TypeError(`Invalid Site Agent manifest:\n- ${result.errors.join("\n- ")}`);
  return manifest;
}

function stripExtensions(value) {
  if (Array.isArray(value)) return value.map(stripExtensions);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith("x-"))
    .map(([key, child]) => [key, stripExtensions(child)]));
}

export function filterSiteAgentManifest(manifest, context = {}, options = {}) {
  assertSiteAgentManifest(manifest);
  const filter = (values = []) => values.filter((capability) => isCapabilityAuthorized(capability, context));
  const queryResources = filter(manifest.queryResources);
  const actions = filter(manifest.actions);
  const events = filter(manifest.events || []);
  const workflows = filter(manifest.workflows || []);
  const navigationDestinations = filter(manifest.navigationDestinations);
  const result = clone({
    ...manifest,
    queryResources,
    navigationDestinations,
    actions,
    ...(manifest.events ? { events } : {}),
    ...(manifest.workflows ? { workflows } : {}),
  });
  return options.stripExtensions ? stripExtensions(result) : result;
}

export function createPublicDiscoveryManifest(manifest) {
  const result = filterSiteAgentManifest(manifest, { authenticated: false, permissions: [] }, { stripExtensions: true });
  assertSiteAgentManifest(result, { publicDocument: true });
  return result;
}

export function getSiteAgentConformance(manifest) {
  const validation = validateSiteAgentManifest(manifest);
  const profiles = Object.fromEntries(SITE_AGENT_PROFILES.map((profile) => [profile, manifest?.profiles?.includes(profile) || false]));
  const coverage = manifest?.conformance?.coverage || {};
  const declaredComplete = validation.valid
    && profiles.query
    && profiles.navigation
    && profiles.action
    && coverage.visibleSurfaces === "complete"
    && coverage.humanActions === "complete";
  return {
    valid: validation.valid,
    errors: validation.errors,
    profiles,
    coverage,
    declaredComplete,
    declaredTutorialComplete: declaredComplete && profiles.presentation,
    declaredOperabilityComplete: declaredComplete && profiles.operability,
    executionVerified: false,
    fullyConformant: false,
    tutorialConformant: false,
    operabilityConformant: false,
  };
}
