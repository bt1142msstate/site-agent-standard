import { validateSchemaDefinition } from "./schema-validation.js";

export const SITE_AGENT_STANDARD_VERSION = "0.2";
export const SITE_AGENT_SUPPORTED_VERSIONS = Object.freeze(["0.1", "0.2"]);
export const SITE_AGENT_PROFILES = Object.freeze(["core", "query", "navigation", "action"]);

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
  });

  const queryIds = new Set();
  queryResources.forEach((resource, index) => {
    const path = `queryResources[${index}]`;
    validateCommon(resource, path, errors);
    if (queryIds.has(resource.id)) errors.push(`${path}.id is duplicated.`);
    queryIds.add(resource.id);
    if (!new Set(["local", "host"]).has(resource.execution)) errors.push(`${path}.execution must be local or host.`);
    if (!Array.isArray(resource.modes) || !resource.modes.length) errors.push(`${path}.modes must not be empty.`);
    if (!isObject(resource.filters)) errors.push(`${path}.filters must be an object of semantic filter schemas.`);
    for (const [filterId, filterSchema] of Object.entries(resource.filters || {})) {
      validateJsonSchema(filterSchema, `${path}.filters.${filterId}`, errors);
    }
    if (resource.destinationId && !destinationIds.has(resource.destinationId)) errors.push(`${path}.destinationId is unknown.`);
    if (resource.resultSchema !== undefined) validateJsonSchema(resource.resultSchema, `${path}.resultSchema`, errors);
    if (strictV02) {
      validateJsonSchema(resource.resultSchema, `${path}.resultSchema`, errors);
      if (!isObject(resource.pagination) || !new Set(["none", "cursor"]).has(resource.pagination.style)) {
        errors.push(`${path}.pagination.style must be none or cursor for standardVersion 0.2.`);
      }
      if (!isObject(resource.freshness) || !freshnessModes.has(resource.freshness.mode)) {
        errors.push(`${path}.freshness.mode must be static, snapshot, or live for standardVersion 0.2.`);
      }
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
    const stepIds = new Set();
    for (const [stepIndex, step] of (workflow.steps || []).entries()) {
      if (!idPattern.test(String(step.id || ""))) errors.push(`${path}.steps[${stepIndex}].id is invalid.`);
      if (stepIds.has(step.id)) errors.push(`${path}.steps[${stepIndex}].id is duplicated.`);
      stepIds.add(step.id);
      if (!capabilityIds.has(step.capabilityId)) errors.push(`${path}.steps[${stepIndex}].capabilityId is unknown.`);
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
  const neededDestinations = new Set([
    ...queryResources.map(({ destinationId }) => destinationId),
    ...actions.map(({ destinationId }) => destinationId),
  ].filter(Boolean));
  const navigationDestinations = filter(manifest.navigationDestinations)
    .filter(({ id, visibility }) => visibility === "public" || neededDestinations.has(id));
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
    executionVerified: false,
    fullyConformant: false,
  };
}
