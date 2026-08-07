import { SiteAgentProblem } from "./problem.js";

function normalizeDeadline(value) {
  if (value === undefined || value === null || value === "") return null;
  const milliseconds = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new SiteAgentProblem({
      code: "invalid-deadline",
      category: "invalid",
      remediation: "revise-input",
    });
  }
  return milliseconds;
}

export function createExecutionContext(request = {}) {
  const deadlineAtMs = normalizeDeadline(request.deadlineAt);
  const signal = request.signal || null;
  const correlationId = request.correlationId ? String(request.correlationId).slice(0, 160) : "";
  const assertActive = () => {
    if (signal?.aborted) {
      throw new SiteAgentProblem({
        code: "request-cancelled",
        category: "cancelled",
        partialEffects: "none",
        correlationId,
      });
    }
    if (deadlineAtMs !== null && Date.now() >= deadlineAtMs) {
      throw new SiteAgentProblem({
        code: "deadline-exceeded",
        category: "timeout",
        retryable: true,
        partialEffects: "none",
        remediation: "retry",
        correlationId,
      });
    }
  };
  assertActive();
  return Object.freeze({
    signal,
    deadlineAt: deadlineAtMs === null ? null : new Date(deadlineAtMs).toISOString(),
    correlationId,
    get remainingMs() {
      return deadlineAtMs === null ? null : Math.max(0, deadlineAtMs - Date.now());
    },
    assertActive,
  });
}
