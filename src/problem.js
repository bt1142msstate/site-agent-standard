const CATEGORIES = new Set([
  "invalid",
  "denied",
  "conflict",
  "cancelled",
  "timeout",
  "unavailable",
  "failed",
]);

const PARTIAL_EFFECTS = new Set(["none", "possible", "applied", "unknown"]);
const REMEDIATIONS = new Set(["none", "revise-input", "request-permission", "reprepare", "retry"]);

function normalizedCode(value) {
  const code = String(value || "site-agent-operation-failed").trim().slice(0, 160);
  if (/^[a-z0-9][a-z0-9._:-]*$/i.test(code)) return code;
  const prefix = code.match(/^([a-z0-9][a-z0-9._-]*)(?::|\s|$)/i)?.[1];
  return prefix || "site-agent-operation-failed";
}

function inferCategory(code) {
  if (/not-authorized|permission|denied/.test(code)) return "denied";
  if (/cancel/.test(code)) return "cancelled";
  if (/deadline|timeout|expired/.test(code)) return "timeout";
  if (/conflict|stale|already-consumed|reconfirmation/.test(code)) return "conflict";
  if (/required|invalid|not-supported|not-found|schema/.test(code)) return "invalid";
  if (/unavailable/.test(code)) return "unavailable";
  return "failed";
}

function defaultRemediation(category) {
  if (category === "denied") return "request-permission";
  if (category === "conflict") return "reprepare";
  if (category === "invalid") return "revise-input";
  if (category === "timeout" || category === "unavailable") return "retry";
  return "none";
}

export class SiteAgentProblem extends Error {
  constructor(input = {}) {
    const code = normalizedCode(input.code || input.message);
    super(code, input.cause ? { cause: input.cause } : undefined);
    this.name = "SiteAgentProblem";
    this.code = code;
    this.title = String(input.title || "Site Agent operation failed").slice(0, 160);
    this.detail = String(input.detail || "").slice(0, 1000);
    this.category = CATEGORIES.has(input.category) ? input.category : inferCategory(code);
    this.retryable = input.retryable === true;
    this.partialEffects = PARTIAL_EFFECTS.has(input.partialEffects) ? input.partialEffects : "none";
    this.requiredPermissions = Object.freeze([...new Set(input.requiredPermissions || [])]
      .map((permission) => String(permission).slice(0, 160)));
    this.remediation = REMEDIATIONS.has(input.remediation)
      ? input.remediation
      : defaultRemediation(this.category);
    this.correlationId = input.correlationId ? String(input.correlationId).slice(0, 160) : "";
  }

  toJSON() {
    return Object.freeze({
      type: "site-agent-problem",
      code: this.code,
      title: this.title,
      detail: this.detail,
      category: this.category,
      retryable: this.retryable,
      partialEffects: this.partialEffects,
      requiredPermissions: this.requiredPermissions,
      remediation: this.remediation,
      correlationId: this.correlationId,
    });
  }
}

export function toSiteAgentProblem(error, defaults = {}) {
  if (error instanceof SiteAgentProblem) return error;
  const code = normalizedCode(error?.code || error?.message || defaults.code);
  return new SiteAgentProblem({
    ...defaults,
    code,
    detail: defaults.detail || "The host could not complete the requested Site Agent operation.",
    cause: error instanceof Error ? error : undefined,
  });
}
