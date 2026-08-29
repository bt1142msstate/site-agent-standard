import { SiteAgentProblem } from "./problem.js";

const stepHandlers = Object.freeze({
  route: "activateRoute",
  state: "applyState",
  "nested-resource": "revealResource",
  target: "revealTarget",
});

function sleep(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason || new Error("navigation-reveal-cancelled"));
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason || new Error("navigation-reveal-cancelled"));
    };
    const timeout = setTimeout(finish, milliseconds);
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function normalizeVerification(value) {
  if (value === true) return { verified: true };
  if (!value) return { verified: false };
  return { ...value, verified: value.verified === true };
}

function safeFailure(step, code, remediation = "retry") {
  return new SiteAgentProblem({
    code,
    category: code.includes("timed-out") ? "timeout" : "conflict",
    remediation,
    partialEffects: "none",
    detail: `The host could not verify reveal step ${step.id} (${step.kind}).`,
  });
}

/**
 * Runs a declared nested reveal path one semantic step at a time. The host
 * performs each step, then independently verifies the observable state before
 * the runtime advances. No selector, DOM inference, or outer-surface fallback
 * is introduced by the coordinator.
 */
export async function runNavigationReveal(options = {}) {
  const destination = options.destination;
  const intent = options.intent || {};
  const adapter = options.adapter;
  const execution = options.execution;
  const reveal = destination?.reveal;
  if (!reveal || reveal.mode !== "nested" || !Array.isArray(reveal.steps)) {
    throw new TypeError("navigation-reveal-contract-required");
  }
  if (!adapter || typeof adapter.verifyStep !== "function") {
    throw new TypeError("navigation-reveal-verifier-required");
  }

  const verifiedSteps = [];
  let finalVerification = null;
  for (const [index, step] of reveal.steps.entries()) {
    execution?.assertActive?.();
    const handler = adapter[stepHandlers[step.kind]] || adapter.revealStep;
    if (typeof handler !== "function") throw safeFailure(step, "navigation-reveal-handler-missing", "revise-input");
    const context = Object.freeze({
      destination,
      execution,
      index,
      intent,
      step,
      verifiedSteps: Object.freeze([...verifiedSteps]),
    });
    await handler.call(adapter, context);

    const timeoutMs = Math.max(100, Number(step.timeoutMs || options.stepTimeoutMs || 5_000));
    const pollIntervalMs = Math.max(16, Number(options.pollIntervalMs || 50));
    const startedAt = Date.now();
    let verification = { verified: false };
    do {
      execution?.assertActive?.();
      verification = normalizeVerification(await adapter.verifyStep(context));
      if (verification.verified) break;
      if (Date.now() - startedAt >= timeoutMs) {
        throw safeFailure(step, "navigation-reveal-step-timed-out");
      }
      await sleep(pollIntervalMs, execution?.signal || options.signal);
    } while (true);

    verifiedSteps.push(step.id);
    options.onStep?.({ index, step, verification, verifiedSteps: [...verifiedSteps] });
    if (step.kind === "target") finalVerification = verification;
  }

  const expectedSteps = reveal.steps.map(({ id }) => id);
  if (verifiedSteps.length !== expectedSteps.length
    || verifiedSteps.some((stepId, index) => stepId !== expectedSteps[index])) {
    throw new Error("navigation-reveal-step-order-invalid");
  }
  if (!finalVerification?.exact || !finalVerification?.visible) {
    throw new Error("navigation-reveal-final-target-not-verified");
  }
  if (finalVerification.targetKind
    && !destination.targetKinds.includes(finalVerification.targetKind)) {
    throw new Error("navigation-reveal-target-kind-invalid");
  }
  return Object.freeze({
    ...finalVerification,
    exact: true,
    visible: true,
    reveal: Object.freeze({ complete: true, verifiedSteps: Object.freeze(verifiedSteps) }),
  });
}
