export const SITE_AGENT_STANDARD_VERSION = "0.1";
export const SITE_AGENT_PROFILES = Object.freeze(["core", "query", "navigation", "action"]);

const idPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const precisions = new Set(["control", "field", "record", "record-page", "surface"]);
const risks = new Set(["read", "reversible", "consequential", "destructive"]);
const confirmations = new Set(["none", "explicit", "typed"]);
const visibilities = new Set(["public", "authenticated"]);
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
  for (const field of ["permissionsAll", "permissionsAny"]) {
    if (capability[field] !== undefined && (!Array.isArray(capability[field]) || capability[field].some((value) => typeof value !== "string"))) {
      errors.push(`${path}.${field} must be an array of permission IDs.`);
    }
  }
}

function validateManifestInternal(manifest, options = {}) {
  const errors = [];
  if (!isObject(manifest)) return { valid: false, errors: ["Manifest must be a JSON object."] };
  if (manifest.standardVersion !== SITE_AGENT_STANDARD_VERSION) errors.push(`standardVersion must be ${SITE_AGENT_STANDARD_VERSION}.`);
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
    if (resource.destinationId && !destinationIds.has(resource.destinationId)) errors.push(`${path}.destinationId is unknown.`);
  });

  const actionIds = new Set();
  actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    validateCommon(action, path, errors);
    if (actionIds.has(action.id)) errors.push(`${path}.id is duplicated.`);
    actionIds.add(action.id);
    if (!risks.has(action.risk)) errors.push(`${path}.risk is invalid.`);
    if (!confirmations.has(action.confirmation)) errors.push(`${path}.confirmation is invalid.`);
    if (!isObject(action.inputSchema)) errors.push(`${path}.inputSchema must be a JSON Schema object.`);
    if (!isObject(action.reconciliation)) {
      errors.push(`${path}.reconciliation must declare stable conflict handling.`);
    } else {
      for (const [field, values] of Object.entries(reconciliationValues)) {
        if (!values.has(action.reconciliation[field])) errors.push(`${path}.reconciliation.${field} is invalid.`);
      }
    }
    if (action.destinationId && !destinationIds.has(action.destinationId)) errors.push(`${path}.destinationId is unknown.`);
    if (action.risk !== "read" && action.confirmation === "none") errors.push(`${path} must require confirmation for a state-changing action.`);
  });

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
  const neededDestinations = new Set([
    ...queryResources.map(({ destinationId }) => destinationId),
    ...actions.map(({ destinationId }) => destinationId),
  ].filter(Boolean));
  const navigationDestinations = filter(manifest.navigationDestinations)
    .filter(({ id, visibility }) => visibility === "public" || neededDestinations.has(id));
  const result = clone({ ...manifest, queryResources, navigationDestinations, actions });
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
  const fullyConformant = validation.valid
    && profiles.query
    && profiles.navigation
    && profiles.action
    && coverage.visibleSurfaces === "complete"
    && coverage.humanActions === "complete";
  return { valid: validation.valid, errors: validation.errors, profiles, coverage, fullyConformant };
}
